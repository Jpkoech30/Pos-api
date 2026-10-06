import express from 'express';
import bcrypt from 'bcryptjs';
import { userDb, shapeUser } from '../db/users.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { isValidPin } from '../lib/validation.js';

const router = express.Router();

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const rows = await userDb.listByShop(req.user.shopId);
  res.json({ staff: rows.map(shapeUser) });
}));

// POST /staff — create a new staff member (owner only)
router.post(
  '/',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const { email, name, password, role, pin } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'email, name, password required' });
    }
    if (!['manager', 'cashier'].includes(role)) {
      return res.status(400).json({ message: 'role must be manager or cashier' });
    }
    if (!isValidPin(pin)) {
      return res.status(400).json({ message: 'pin must be exactly 4 digits' });
    }

    const existing = await userDb.findByEmail(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const pinHash = await bcrypt.hash(pin, 10);

    const user = await userDb.create({
      email: email.toLowerCase(),
      name,
      passwordHash,
      pinHash,
      shopId: req.user.shopId,
      role,
    });

    res.status(201).json({ user: shapeUser(user) });
  }),
);

// POST /staff/verify-pin — check a PIN against all active staff in the shop.
// Used by the shared device to identify who's checking in.
//
// IMPORTANT: a wrong PIN is a 400, not a 401. The user is authenticated
// (they have a valid session) — they just typed the wrong code. Returning
// 401 here would trigger the global sign-out interceptor and log them out.
router.post(
  '/verify-pin',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { pin } = req.body;
    if (!isValidPin(pin)) {
      return res.status(400).json({ message: 'pin must be exactly 4 digits' });
    }

    const rows = await userDb.listByShop(req.user.shopId);
    for (const candidate of rows) {
      if (!candidate.is_active) continue;

      const full = await userDb.findById(candidate.id);
      if (!full?.pin_hash) continue;

      const match = await bcrypt.compare(pin, full.pin_hash);
      if (match) {
        return res.json({ staff: shapeUser(full) });
      }
    }

    return res.status(400).json({ message: 'Incorrect PIN' });
  }),
);

// POST /staff/:id/pin — reset a staff member's PIN (owner only)
router.post(
  '/:id/pin',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const { pin } = req.body;
    if (!isValidPin(pin)) {
      return res.status(400).json({ message: 'pin must be exactly 4 digits' });
    }

    const user = await userDb.findById(req.params.id);
    if (!user || String(user.shop_id) !== String(req.user.shopId)) {
      return res.status(404).json({ message: 'Staff not found' });
    }

    const pinHash = await bcrypt.hash(pin, 10);
    const updated = await userDb.setPinHash(user.id, pinHash);
    res.json({ user: shapeUser(updated) });
  }),
);

router.patch(
  '/:id/role',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    if (!['manager', 'cashier'].includes(role)) {
      return res.status(400).json({ message: 'role must be manager or cashier' });
    }
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot change your own role' });
    }
    const user = await userDb.setRole(req.params.id, role, req.user.shopId);
    if (!user) return res.status(404).json({ message: 'Staff not found' });
    res.json({ user: shapeUser(user) });
  }),
);

router.patch(
  '/:id/deactivate',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot deactivate yourself' });
    }
    const user = await userDb.setActive(req.params.id, false, req.user.shopId);
    if (!user) return res.status(404).json({ message: 'Staff not found' });
    res.json({ user: shapeUser(user) });
  }),
);

router.patch(
  '/:id/activate',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const user = await userDb.setActive(req.params.id, true, req.user.shopId);
    if (!user) return res.status(404).json({ message: 'Staff not found' });
    res.json({ user: shapeUser(user) });
  }),
);

router.post(
  '/:id/reset-password',
  requireAuth,
  requireRole('owner'),
  asyncHandler(async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be 6+ chars' });
    }
    const user = await userDb.findById(req.params.id);
    if (!user || String(user.shop_id) !== String(req.user.shopId)) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    const hash = await bcrypt.hash(password, 10);
    await userDb.updatePassword(user.id, hash);
    res.json({ ok: true });
  }),
);

export default router;