import { query } from './pool.js';

async function findByIdRaw(id) {
  const { rows } = await query('SELECT * FROM shops WHERE id = $1', [id]);
  return rows[0] || null;
}

export const shopDb = {
  async create({ name, ownerId, mpesaNumber = null }) {
    const { rows } = await query(
      `INSERT INTO shops (name, owner_id, mpesa_number)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, ownerId, mpesaNumber],
    );
    return rows[0];
  },

  async findById(id) { return findByIdRaw(id); },

  async update(id, fields) {
    const sets = [];
    const values = [];
    let i = 1;

    const map = {
      name: 'name',
      mpesaNumber: 'mpesa_number',
      address: 'address',
    };

    for (const [key, col] of Object.entries(map)) {
      if (fields[key] !== undefined) {
        sets.push(`${col} = $${i}`);
        values.push(fields[key]);
        i += 1;
      }
    }

    if (sets.length === 0) return findByIdRaw(id);
    values.push(id);
    const { rows } = await query(
      `UPDATE shops SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    return rows[0] || null;
  },

  async setTaxConfig(id, { vatRegistered, vatRate, pricesIncludeVat }) {
    const { rows } = await query(
      `UPDATE shops
       SET vat_registered    = $1,
           vat_rate          = $2,
           prices_include_vat = $3
       WHERE id = $4
       RETURNING *`,
      [Boolean(vatRegistered), Number(vatRate), Boolean(pricesIncludeVat), id],
    );
    return rows[0] || null;
  },

  async setDaraja(id, fields) {
    const current = await findByIdRaw(id);
    if (!current) return null;

    const consumerKey    = fields.consumerKey    ?? current.daraja_consumer_key;
    const consumerSecret = fields.consumerSecret ?? current.daraja_consumer_secret;
    const passkey        = fields.passkey        ?? current.daraja_passkey;
    const shortcode      = fields.shortcode      ?? current.daraja_shortcode;
    const env            = fields.env            ?? current.daraja_env ?? 'sandbox';

    if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
      const err = new Error('All four credentials are required for first-time setup');
      err.status = 400;
      throw err;
    }

    const { rows } = await query(
      `UPDATE shops
       SET daraja_consumer_key    = $1,
           daraja_consumer_secret = $2,
           daraja_passkey         = $3,
           daraja_shortcode       = $4,
           daraja_env             = $5,
           stk_enabled            = true
       WHERE id = $6
       RETURNING *`,
      [consumerKey, consumerSecret, passkey, shortcode, env, id],
    );
    return rows[0] || null;
  },

  async clearDaraja(id) {
    const { rows } = await query(
      `UPDATE shops
       SET daraja_consumer_key    = NULL,
           daraja_consumer_secret = NULL,
           daraja_passkey         = NULL,
           daraja_shortcode       = NULL,
           stk_enabled            = false
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    return rows[0] || null;
  },
};

export function getDarajaCredentials(row) {
  if (!row) return null;
  if (!row.daraja_consumer_key || !row.daraja_consumer_secret ||
      !row.daraja_passkey || !row.daraja_shortcode) {
    return null;
  }
  return {
    consumerKey: row.daraja_consumer_key,
    consumerSecret: row.daraja_consumer_secret,
    passkey: row.daraja_passkey,
    shortcode: row.daraja_shortcode,
    env: row.daraja_env || 'sandbox',
  };
}