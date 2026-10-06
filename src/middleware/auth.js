import jwt from 'jsonwebtoken';
import { userDb } from '../db/users.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Missing token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await userDb.findById(payload.sub);
    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Invalid or inactive user' });
    }
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      shopId: user.shop_id,
    };
    console.log(`AUTH: ${user.email} → shopId ${user.shop_id}`);
    next();
  } catch (err) {
    console.error('AUTH FAILED:', err.message);
    return res.status(401).json({ message: 'Invalid token' });
  }
}