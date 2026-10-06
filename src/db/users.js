import { query } from './pool.js';

export const userDb = {
  async findByEmail(email) {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  },

  async listByShop(shopId) {
    const { rows } = await query(
      `SELECT id, email, name, role, is_active, pin_hash, created_at
       FROM users WHERE shop_id = $1 ORDER BY created_at`,
      [shopId],
    );
    return rows;
  },

  async create({ email, name, passwordHash, shopId, role = 'cashier', pinHash = null }) {
    const { rows } = await query(
      `INSERT INTO users (email, name, password_hash, shop_id, role, pin_hash)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [email, name, passwordHash, shopId, role, pinHash],
    );
    return rows[0];
  },

  async updateProfile(id, { name }) {
    const { rows } = await query(
      'UPDATE users SET name = COALESCE($1, name) WHERE id = $2 RETURNING *',
      [name, id],
    );
    return rows[0] || null;
  },

  async updatePassword(id, passwordHash) {
    const { rows } = await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *',
      [passwordHash, id],
    );
    return rows[0] || null;
  },

  async setPinHash(id, pinHash) {
    const { rows } = await query(
      'UPDATE users SET pin_hash = $1 WHERE id = $2 RETURNING *',
      [pinHash, id],
    );
    return rows[0] || null;
  },

  async setRole(id, role, shopId) {
    const { rows } = await query(
      'UPDATE users SET role = $1 WHERE id = $2 AND shop_id = $3 RETURNING *',
      [role, id, shopId],
    );
    return rows[0] || null;
  },

  async setActive(id, isActive, shopId) {
    const { rows } = await query(
      'UPDATE users SET is_active = $1 WHERE id = $2 AND shop_id = $3 RETURNING *',
      [isActive, id, shopId],
    );
    return rows[0] || null;
  },
};