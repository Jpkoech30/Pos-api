import express from 'express';
import { productDb } from '../db/products.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { cleanGtin } from '../utils/gtin.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validateBarcode } from '../lib/validation.js';
import { shapeProduct } from '../serializers/product.js';
import { STOCK_ADJUST_REASONS } from '../config/constants.js';

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const rows = await productDb.list(req.user.shopId);
  res.json({ products: rows.map(shapeProduct) });
}));

router.get('/lookup/:barcode', requireAuth, asyncHandler(async (req, res) => {
  const row = await productDb.findByBarcode(req.params.barcode, req.user.shopId);
  if (!row) {
    return res.status(404).json({ message: 'Product not found for this barcode' });
  }
  res.json({ product: shapeProduct(row) });
}));

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const row = await productDb.findById(req.params.id, req.user.shopId);
  if (!row) return res.status(404).json({ message: 'Product not found' });
  const barcodes = await productDb.findBarcodes(row.id);
  res.json({
    product: {
      ...shapeProduct(row),
      barcodes: barcodes.map((b) => ({
        id: String(b.id),
        gtin: b.gtin,
        symbology: b.symbology,
        unitType: b.unit_type,
        isPrimary: b.is_primary,
      })),
    },
  });
}));

router.get(
  '/:id/movements',
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await productDb.getMovements(
      req.params.id,
      req.user.shopId,
      limit,
    );
    res.json({
      movements: rows.map((r) => ({
        id: String(r.id),
        change: r.change,
        reason: r.reason,
        note: r.note,
        createdAt: r.created_at,
      })),
    });
  }),
);

router.post(
  '/',
  requireAuth,
  requireRole('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const {
      name, price, costPrice, category,
      supplier, manufacturer,
      sku, barcode, stock,
    } = req.body;

    if (!name || typeof price !== 'number' || price < 0) {
      return res.status(400).json({ message: 'name and a non-negative price are required' });
    }
    if (costPrice != null && (typeof costPrice !== 'number' || costPrice < 0)) {
      return res.status(400).json({ message: 'costPrice must be a non-negative number' });
    }
    const barcodeError = validateBarcode(barcode);
    if (barcodeError) return res.status(400).json({ message: barcodeError });

    const row = await productDb.create(req.user.shopId, {
      name,
      price,
      costPrice: costPrice ?? null,
      category: category || 'Uncategorized',
      supplier: supplier || null,
      manufacturer: manufacturer || null,
      sku: sku || null,
      barcode: barcode ? cleanGtin(barcode) : null,
      stock: Number.isInteger(stock) ? stock : 0,
    });
    res.status(201).json({ product: shapeProduct(row) });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('owner', 'manager'),
  asyncHandler(async (req, res) => {
    if (req.body.barcode !== undefined && req.body.barcode !== null) {
      const barcodeError = validateBarcode(req.body.barcode);
      if (barcodeError) return res.status(400).json({ message: barcodeError });
      req.body.barcode = req.body.barcode ? cleanGtin(req.body.barcode) : null;
    }
    const row = await productDb.update(req.params.id, req.user.shopId, req.body);
    if (!row) return res.status(404).json({ message: 'Product not found' });
    res.json({ product: shapeProduct(row) });
  }),
);

router.post(
  '/:id/stock',
  requireAuth,
  requireRole('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const { change, reason, note } = req.body;

    if (!Number.isInteger(change) || change === 0) {
      return res.status(400).json({ message: 'change must be a non-zero integer' });
    }
    if (!STOCK_ADJUST_REASONS.includes(reason)) {
      return res.status(400).json({
        message: `reason must be one of: ${STOCK_ADJUST_REASONS.join(', ')}`,
      });
    }

    const product = await productDb.adjustStock(req.params.id, req.user.shopId, {
      change,
      reason,
      note: note || null,
    });
    res.json({ product: shapeProduct(product) });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const row = await productDb.remove(req.params.id, req.user.shopId);
    if (!row) return res.status(404).json({ message: 'Product not found' });
    res.json({ ok: true });
  }),
);

export default router;