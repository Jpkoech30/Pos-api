-- Shops
CREATE TABLE IF NOT EXISTS shops (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  owner_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  mpesa_number  TEXT,
  address       TEXT,
  daraja_consumer_key    TEXT,
  daraja_consumer_secret TEXT,
  daraja_passkey         TEXT,
  daraja_shortcode       TEXT,
  daraja_env             TEXT NOT NULL DEFAULT 'sandbox',
  stk_enabled            BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  shop_id       INTEGER REFERENCES shops(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'cashier',
  pin_hash      TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id         SERIAL PRIMARY KEY,
  shop_id    INTEGER REFERENCES shops(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  price      NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  cost_price NUMERIC(10, 2) CHECK (cost_price IS NULL OR cost_price >= 0),
  category   TEXT NOT NULL DEFAULT 'Uncategorized',
  sku        TEXT,
  barcode    TEXT,
  stock      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, sku),
  UNIQUE (shop_id, barcode)
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  shop_id         INTEGER REFERENCES shops(id) ON DELETE CASCADE,
  staff_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subtotal        NUMERIC(10, 2) NOT NULL,
  tax             NUMERIC(10, 2) NOT NULL,
  total           NUMERIC(10, 2) NOT NULL,
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'mpesa', 'mpesa_stk')),
  amount_tendered NUMERIC(10, 2),
  change_given    NUMERIC(10, 2),
  mpesa_phone     TEXT,
  payment_status  TEXT NOT NULL DEFAULT 'completed',
  mpesa_checkout_request_id TEXT,
  mpesa_receipt_number      TEXT,
  mpesa_result_code         INTEGER,
  mpesa_result_desc         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order line items (price + name + cost_price are snapshots)
CREATE TABLE IF NOT EXISTS order_items (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  price       NUMERIC(10, 2) NOT NULL,
  cost_price  NUMERIC(10, 2),
  quantity    INTEGER NOT NULL CHECK (quantity > 0)
);

-- Note: indexes that depend on columns added by migrations
-- (users.shop_id, products.shop_id, orders.shop_id) are created
-- in the migration files, not here.