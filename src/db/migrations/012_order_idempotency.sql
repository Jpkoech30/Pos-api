-- Idempotency key on orders. The client generates a UUID per checkout
-- attempt and sends it with every retry of that attempt. The unique
-- index is what actually prevents duplicate orders under concurrent
-- requests — the pre-check in orderDb.create is just an optimisation.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency
  ON orders (shop_id, idempotency_key);