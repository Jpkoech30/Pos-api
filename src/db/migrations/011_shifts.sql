-- Shifts: track open/close of a till session per staff member.
-- Orders created while a shift is open get tagged with shift_id.

CREATE TABLE IF NOT EXISTS shifts (
  id              SERIAL PRIMARY KEY,
  shop_id         INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  staff_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  opening_float   NUMERIC(10,2),
  closing_counted NUMERIC(10,2),
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'closed')),
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_shifts_shop_status
  ON shifts (shop_id, status);

CREATE INDEX IF NOT EXISTS idx_shifts_staff
  ON shifts (staff_id, opened_at DESC);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shift_id INTEGER
  REFERENCES shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shift
  ON orders (shift_id);

CREATE TABLE IF NOT EXISTS shift_reports (
  shift_id         INTEGER PRIMARY KEY
                   REFERENCES shifts(id) ON DELETE CASCADE,
  shop_id          INTEGER NOT NULL,
  order_count      INTEGER NOT NULL,
  gross_sales      NUMERIC(10,2) NOT NULL,
  net_sales        NUMERIC(10,2) NOT NULL,
  vat_total        NUMERIC(10,2) NOT NULL,
  cash_total       NUMERIC(10,2) NOT NULL,
  mpesa_total      NUMERIC(10,2) NOT NULL,
  stk_total        NUMERIC(10,2) NOT NULL,
  expected_cash    NUMERIC(10,2) NOT NULL,
  counted_cash     NUMERIC(10,2),
  variance         NUMERIC(10,2),
  pending_count    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);