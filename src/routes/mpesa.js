import express from 'express';
import { orderDb } from '../db/orders.js';
import { shopDb, getDarajaCredentials } from '../db/shops.js';
import { shiftDb } from '../db/shifts.js';
import { requireAuth } from '../middleware/auth.js';
import { initiateStkPush, queryStkPush } from '../services/daraja.js';

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function callbackUrl() {
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) throw new Error('PUBLIC_BASE_URL not set');
  return `${base}/mpesa/callback`;
}

// POST /mpesa/stkpush — initiate a payment
router.post('/stkpush', requireAuth, asyncHandler(async (req, res) => {
  const { phone, items, idempotencyKey } = req.body;

  if (!phone || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'phone and items are required' });
  }

  const shop = await shopDb.findById(req.user.shopId);
  const creds = getDarajaCredentials(shop);
  if (!creds) {
    return res.status(400).json({
      message: 'STK Push is not configured for this shop',
    });
  }

  const vatRegistered = shop?.vat_registered === true;
  const vatRate = vatRegistered ? Number(shop.vat_rate) : 0;
  const taxInclusive = shop?.prices_include_vat !== false;

  const currentShift = await shiftDb.findCurrent(req.user.shopId);
  const shiftId = currentShift ? currentShift.id : null;

  const order = await orderDb.create({
    shopId: req.user.shopId,
    staffId: req.user.id,
    shiftId,
    items,
    paymentMethod: 'mpesa_stk',
    vatRate,
    taxInclusive,
    paymentStatus: 'pending',
    mpesaPhone: phone,
    idempotencyKey,
  });

  // If the order already existed (idempotent replay) and has a checkout
  // ID, just return it — don't fire a second STK push.
  if (order.mpesaCheckoutRequestId) {
    return res.status(201).json({
      orderId: String(order.id),
      checkoutRequestId: order.mpesaCheckoutRequestId,
      customerMessage: null,
    });
  }

  let stk;
  try {
    stk = await initiateStkPush({
      credentials: creds,
      phone,
      amount: order.total,
      accountRef: `ORDER-${order.id}`,
      description: 'Jengabiz Sale',
      callbackUrl: callbackUrl(),
    });
  } catch (err) {
    const safaricomMsg =
      err.response?.data?.errorMessage ||
      err.response?.data?.ResponseDescription ||
      err.message ||
      'STK Push request rejected';

    console.error('STK push failed:', safaricomMsg);

    await orderDb.completePayment(order.id, {
      paymentStatus: 'failed',
      mpesaReceiptNumber: null,
      mpesaResultCode: null,
      mpesaResultDesc: `Push failed: ${safaricomMsg}`,
    });

    return res.status(502).json({
      message: `M-Pesa rejected the request: ${safaricomMsg}`,
    });
  }

  await orderDb.setCheckoutRequestId(
    order.id,
    stk.checkoutRequestId,
    req.user.shopId,
  );

  res.status(201).json({
    orderId: String(order.id),
    checkoutRequestId: stk.checkoutRequestId,
    customerMessage: stk.customerMessage,
  });
}));

// GET /mpesa/status/:orderId — read from our DB
router.get('/status/:orderId', requireAuth, asyncHandler(async (req, res) => {
  const order = await orderDb.findById(req.params.orderId, req.user.shopId);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json({ status: order.paymentStatus, order });
}));

// GET /mpesa/query/:orderId — ask Safaricom directly
router.get('/query/:orderId', requireAuth, asyncHandler(async (req, res) => {
  const order = await orderDb.findById(req.params.orderId, req.user.shopId);
  if (!order) return res.status(404).json({ message: 'Order not found' });

  if (order.paymentStatus !== 'pending') {
    return res.json({ status: order.paymentStatus, order });
  }

  const checkoutId = order.mpesaCheckoutRequestId;

  if (!checkoutId) {
    await orderDb.completePayment(order.id, {
      paymentStatus: 'failed',
      mpesaReceiptNumber: null,
      mpesaResultCode: 1037,
      mpesaResultDesc: 'STK Push was never sent to Safaricom',
    });
    const updated = await orderDb.findById(order.id, req.user.shopId);
    return res.json({ status: updated.paymentStatus, order: updated });
  }

  const shop = await shopDb.findById(req.user.shopId);
  const creds = getDarajaCredentials(shop);
  if (!creds) {
    return res.json({ status: order.paymentStatus, order });
  }

  try {
    const result = await queryStkPush({
      credentials: creds,
      checkoutRequestId: checkoutId,
    });

    const code = String(result.ResultCode);

    if (code === '0') {
      await orderDb.completePayment(order.id, {
        paymentStatus: 'completed',
        mpesaReceiptNumber: result.MpesaReceiptNumber || null,
        mpesaResultCode: 0,
        mpesaResultDesc: result.ResultDesc,
      });
    } else {
      await orderDb.completePayment(order.id, {
        paymentStatus: 'failed',
        mpesaReceiptNumber: null,
        mpesaResultCode: parseInt(code, 10),
        mpesaResultDesc: result.ResultDesc,
      });
    }

    const updated = await orderDb.findById(order.id, req.user.shopId);
    res.json({ status: updated.paymentStatus, order: updated });
  } catch (err) {
    console.warn('STK query failed:', err.response?.data || err.message);
    res.json({ status: order.paymentStatus, order });
  }
}));

// POST /mpesa/cancel/:orderId — cashier abandons the wait
router.post('/cancel/:orderId', requireAuth, asyncHandler(async (req, res) => {
  const order = await orderDb.cancelPending(
    req.params.orderId,
    req.user.shopId,
    'Cancelled by cashier',
  );
  if (!order) {
    return res.status(404).json({
      message: 'Order not found, not pending, or belongs to another shop',
    });
  }
  res.json({ order });
}));

// POST /mpesa/callback — Safaricom posts here
router.post('/callback', asyncHandler(async (req, res) => {
  console.log('=== MPESA CALLBACK ===');
  console.log(JSON.stringify(req.body, null, 2));

  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });

  const cb = req.body?.Body?.stkCallback;
  if (!cb) return;

  const order = await orderDb.findByCheckoutRequestId(cb.CheckoutRequestID);
  if (!order) {
    console.warn('Callback for unknown checkout ID:', cb.CheckoutRequestID);
    return;
  }

  if (order.paymentStatus !== 'pending') {
    console.log(
      `Ignoring callback — order ${order.id} already ${order.paymentStatus}`,
    );
    return;
  }

  if (cb.ResultCode === 0) {
    const items = cb.CallbackMetadata?.Item || [];
    const get = (name) => items.find((i) => i.Name === name)?.Value;
    await orderDb.completePayment(order.id, {
      paymentStatus: 'completed',
      mpesaReceiptNumber: get('MpesaReceiptNumber') || null,
      mpesaResultCode: 0,
      mpesaResultDesc: cb.ResultDesc,
    });
  } else {
    await orderDb.completePayment(order.id, {
      paymentStatus: 'failed',
      mpesaReceiptNumber: null,
      mpesaResultCode: cb.ResultCode,
      mpesaResultDesc: cb.ResultDesc,
    });
  }
}));

export default router;