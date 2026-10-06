import express from 'express';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = express.Router();

router.get('/search', requireAuth, asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q.length < 2) {
    return res.json({ results: [] });
  }

  const { rows } = await query(
    `SELECT id, name, brand, manufacturer, supplier, category, unit,
            suggested_price, suggested_cost, typical_barcode
     FROM product_catalog
     WHERE LOWER(name) LIKE $1
        OR LOWER(COALESCE(brand, '')) LIKE $1
        OR LOWER(COALESCE(manufacturer, '')) LIKE $1
     ORDER BY
       CASE WHEN LOWER(name) LIKE $2 THEN 0 ELSE 1 END,
       CASE WHEN LOWER(COALESCE(brand, '')) LIKE $2 THEN 0 ELSE 1 END,
       name
     LIMIT 12`,
    [`%${q}%`, `${q}%`],
  );

  res.json({
    results: rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      brand: r.brand,
      manufacturer: r.manufacturer,
      supplier: r.supplier,
      category: r.category,
      unit: r.unit,
      suggestedPrice: r.suggested_price != null ? Number(r.suggested_price) : null,
      suggestedCost: r.suggested_cost != null ? Number(r.suggested_cost) : null,
      typicalBarcode: r.typical_barcode,
    })),
  });
}));

export default router;