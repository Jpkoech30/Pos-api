-- Multi-tenancy, roles, and per-shop Daraja credentials.
--
-- Every meaningful row is scoped to a shop. Existing single-shop
-- installs get one default shop created and all their data attached.

CREATE TABLE IF NOT EXISTS shops (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  owner_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  mpesa_number  TEXT,
  address       TEXT,

  -- Per-shop Daraja (M-Pesa STK Push). Each shop brings their own paybill.
  daraja_consumer_key    TEXT,
  daraja_consumer_secret TEXT,
  daraja_passkey         TEXT,
  daraja_shortcode       TEXT,
  daraja_env             TEXT NOT NULL DEFAULT 'sandbox',
  stk_enabled            BOOLEAN NOT NULL DEFAULT false,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_id   INTEGER REFERENCES shops(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role      TEXT NOT NULL DEFAULT 'cashier';
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Products / Orders
ALTER TABLE products ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE;
ALTER TABLE orders   ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_shop    ON users(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop   ON orders(shop_id);

-- Backfill: create a default shop if any users exist without one.
DO $$
DECLARE
  new_shop_id   INTEGER;
  first_user_id INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE shop_id IS NULL) THEN
    SELECT id INTO first_user_id
    FROM users WHERE shop_id IS NULL
    ORDER BY id LIMIT 1;

    INSERT INTO shops (name, owner_id)
    VALUES ('My Shop', first_user_id)
    RETURNING id INTO new_shop_id;

    UPDATE users    SET shop_id = new_shop_id WHERE shop_id IS NULL;
    UPDATE products SET shop_id = new_shop_id WHERE shop_id IS NULL;
    UPDATE orders   SET shop_id = new_shop_id WHERE shop_id IS NULL;

    UPDATE users SET role = 'owner'   WHERE id = first_user_id;
    UPDATE users SET role = 'cashier'
      WHERE shop_id = new_shop_id AND id <> first_user_id;
  END IF;
END $$;