

import express from 'express';
import { productDb } from '../db/products.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// GET /stock/activity — recent movements across all products
router.get('/activity', requireAuth, asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const rows = await productDb.getRecentActivity(req.user.shopId, limit);
  res.json({
    activity: rows.map((r) => ({
      id: String(r.id),
      productId: String(r.product_id),
      productName: r.product_name,
      change: r.change,
      reason: r.reason,
      note: r.note,
      createdAt: r.created_at,
    })),
  });
}));

export default router;