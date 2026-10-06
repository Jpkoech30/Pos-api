import express from 'express';
import { shopDb } from '../db/shops.js';
import { shapeShop } from '../serializers/shop.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { MAX_VAT_RATE } from '../config/constants.js';
import { testCredentials } from '../services/daraja.js';

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const shop = await shopDb.findById(req.user.shopId);
  res.json({ shop: shapeShop(shop) });
}));

router.patch(
  '/',
  requireAuth,
  requireRole('owner', 'manager'),
  asyncHandler(async (req, res) => {
    const { name, mpesaNumber, address } = req.body;
    const shop = await shopDb.update(req.user.shopId, {
      name, mpesaNumber, address,
    });
    res.json({ shop: shapeShop(shop) });
  }),
);

router.put(
  '/tax',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const { vatRegistered, vatRate, pricesIncludeVat } = req.body;

    if (typeof vatRegistered !== 'boolean') {
      return res.status(400).json({ message: 'vatRegistered must be a boolean' });
    }
    const rate = Number(vatRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > MAX_VAT_RATE) {
      return res.status(400).json({ message: `vatRate must be between 0 and ${MAX_VAT_RATE}` });
    }

    const shop = await shopDb.setTaxConfig(req.user.shopId, {
      vatRegistered,
      vatRate: rate,
      pricesIncludeVat: Boolean(pricesIncludeVat),
    });
    res.json({ shop: shapeShop(shop) });
  }),
);

router.put(
  '/daraja',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const { consumerKey, consumerSecret, passkey, shortcode, env } = req.body;
    const shop = await shopDb.setDaraja(req.user.shopId, {
      consumerKey:    consumerKey    || undefined,
      consumerSecret: consumerSecret || undefined,
      passkey:        passkey        || undefined,
      shortcode:      shortcode      || undefined,
      env:            env === 'production' ? 'production' : env === 'sandbox' ? 'sandbox' : undefined,
    });
    res.json({ shop: shapeShop(shop) });
  }),
);

router.delete(
  '/daraja',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const shop = await shopDb.clearDaraja(req.user.shopId);
    res.json({ shop: shapeShop(shop) });
  }),
);

router.post(
  '/daraja/test',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const { consumerKey, consumerSecret, passkey, shortcode, env } = req.body;
    const current = await shopDb.findById(req.user.shopId);
    const payload = {
      consumerKey:    consumerKey    || current?.daraja_consumer_key,
      consumerSecret: consumerSecret || current?.daraja_consumer_secret,
      passkey:        passkey        || current?.daraja_passkey,
      shortcode:      shortcode      || current?.daraja_shortcode,
      env:            env || current?.daraja_env || 'sandbox',
    };
    if (!payload.consumerKey || !payload.consumerSecret ||
        !payload.passkey || !payload.shortcode) {
      return res.status(400).json({
        message: 'All four credentials are required to test',
      });
    }
    try {
      await testCredentials(payload);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ ok: false, message: 'Credentials rejected by Safaricom' });
    }
  }),
);

export default router;