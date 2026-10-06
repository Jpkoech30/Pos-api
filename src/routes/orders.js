import express from 'express';
import { orderDb } from '../db/orders.js';
import { userDb } from '../db/users.js';
import { shopDb } from '../db/shops.js';
import { shiftDb } from '../db/shifts.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

async function resolveStaffId(req, providedStaffId) {
  if (!providedStaffId) return req.user.id;
  try {
    const staff = await userDb.findById(providedStaffId);
    if (staff && staff.is_active && String(staff.shop_id) === String(req.user.shopId)) {
      return staff.id;
    }
  } catch (err) {
    console.warn('Staff id validation failed:', err.message);
  }
  return req.user.id;
}

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const {
    items, paymentMethod,
    amountTendered, changeGiven, mpesaPhone,
    staffId: providedStaffId,
    idempotencyKey,
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Order must have at least one item' });
  }
  if (!['cash', 'card', 'mpesa', 'mpesa_stk'].includes(paymentMethod)) {
    return res.status(400).json({ message: 'Invalid payment method' });
  }
  for (const item of items) {
    if (!item.productId || !item.name || typeof item.price !== 'number' || !item.quantity) {
      return res.status(400).json({ message: 'Invalid item in order' });
    }
  }

  const shop = await shopDb.findById(req.user.shopId);
  const vatRegistered = shop?.vat_registered === true;
  const vatRate = vatRegistered ? Number(shop.vat_rate) : 0;
  const taxInclusive = shop?.prices_include_vat !== false;

  const staffId = await resolveStaffId(req, providedStaffId);

  const currentShift = await shiftDb.findCurrent(req.user.shopId);
  const shiftId = currentShift ? currentShift.id : null;

  const order = await orderDb.create({
    shopId: req.user.shopId,
    staffId,
    shiftId,
    items,
    paymentMethod,
    vatRate,
    taxInclusive,
    amountTendered,
    changeGiven,
    mpesaPhone,
    idempotencyKey,
  });
  res.status(201).json({ order });
}));

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const data = await orderDb.list(req.user.shopId);
  res.json(data);
}));

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const order = await orderDb.findById(req.params.id, req.user.shopId);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json({ order });
}));

export default router;