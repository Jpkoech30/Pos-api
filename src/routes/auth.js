import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { userDb } from '../db/users.js';
import { shopDb } from '../db/shops.js';
import { shapeUser } from '../serializers/user.js';
import { shapeShop } from '../serializers/shop.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { JWT_EXPIRES_IN } from '../config/constants.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function issueToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, shopId: user.shop_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

router.post('/signup', asyncHandler(async (req, res) => {
  const { email, password, name, shopName } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ message: 'email, password, name required' });
  }
  if (!shopName) {
    return res.status(400).json({ message: 'shopName required' });
  }

  const existing = await userDb.findByEmail(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const hash = await bcrypt.hash(password, 10);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: userRows } = await client.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, 'owner')
       RETURNING *`,
      [email.toLowerCase(), name, hash],
    );
    const user = userRows[0];

    const { rows: shopRows } = await client.query(
      `INSERT INTO shops (name, owner_id)
       VALUES ($1, $2)
       RETURNING *`,
      [shopName, user.id],
    );
    const shop = shopRows[0];

    await client.query(
      'UPDATE users SET shop_id = $1 WHERE id = $2',
      [shop.id, user.id],
    );
    user.shop_id = shop.id;

    await client.query('COMMIT');

    const token = issueToken(user);
    res.status(201).json({
      token,
      user: shapeUser(user),
      shop: shapeShop(shop),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'email and password required' });
  }

  const user = await userDb.findByEmail(email.toLowerCase());
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  if (!user.is_active) {
    return res.status(403).json({ message: 'Account deactivated' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  const shop = await shopDb.findById(user.shop_id);
  const token = issueToken(user);
  res.json({
    token,
    user: shapeUser(user),
    shop: shapeShop(shop),
  });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await userDb.findById(req.user.id);
  const shop = await shopDb.findById(user.shop_id);
  res.json({ user: shapeUser(user), shop: shapeShop(shop) });
}));

export default router;