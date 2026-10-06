import express from 'express';
import { query } from '../db/pool.js';
import { shopDb } from '../db/shops.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { DEFAULT_VAT_RATE, TOT_RATE } from '../config/constants.js';

const router = express.Router();

router.get('/summary', requireAuth, asyncHandler(async (req, res) => {
  const shop = await shopDb.findById(req.user.shopId);
  const vatRegistered = shop?.vat_registered === true;
  const vatRate = Number(shop?.vat_rate ?? DEFAULT_VAT_RATE);

  const now = new Date();
  const from = req.query.from || new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().slice(0, 10);
  const to = req.query.to || now.toISOString().slice(0, 10);

  const { rows } = await query(
    `SELECT
       COALESCE(SUM(subtotal), 0) AS net_sales,
       COALESCE(SUM(tax), 0)      AS vat_collected,
       COALESCE(SUM(total), 0)    AS gross_sales,
       COUNT(*)                   AS order_count
     FROM orders
     WHERE shop_id = $1
       AND payment_status = 'completed'
       AND created_at >= $2::date
       AND created_at <  ($3::date + INTERVAL '1 day')`,
    [req.user.shopId, from, to],
  );

  const s = rows[0] || {};
  const netSales = Number(s.net_sales) || 0;
  const vatCollected = Number(s.vat_collected) || 0;
  const grossSales = Number(s.gross_sales) || 0;
  const orderCount = Number(s.order_count) || 0;

  const totRate = TOT_RATE;
  const totLiability = !vatRegistered ? +(grossSales * totRate / 100).toFixed(2) : 0;

  res.json({
    period: { from, to },
    orderCount,
    netSales: +netSales.toFixed(2),
    vatCollected: +vatCollected.toFixed(2),
    grossSales: +grossSales.toFixed(2),
    vatRegistered,
    vatRate,
    totRate,
    totLiability,
  });
}));

export default router;