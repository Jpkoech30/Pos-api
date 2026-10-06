import express from 'express';
import bcrypt from 'bcryptjs';
import { userDb, shapeUser } from '../db/users.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await userDb.findById(req.user.id);
  res.json({ user: shapeUser(user) });
}));

router.patch('/me', requireAuth, asyncHandler(async (req, res) => {
  const { name } = req.body;
  const user = await userDb.updateProfile(req.user.id, { name });
  res.json({ user: shapeUser(user) });
}));

router.post('/me/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'Both passwords required (new must be 6+ chars)' });
  }

  const user = await userDb.findById(req.user.id);
  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) return res.status(401).json({ message: 'Current password is incorrect' });

  const hash = await bcrypt.hash(newPassword, 10);
  await userDb.updatePassword(req.user.id, hash);
  res.json({ ok: true });
}));

export default router;