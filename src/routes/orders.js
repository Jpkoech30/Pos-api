import express from 'express';
import { orderDb } from '../db/orders.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { createOrder } from '../services/orders.js';

const router = express.Router();

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

  const order = await createOrder(req, {
    items,
    paymentMethod,
    providedStaffId,
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