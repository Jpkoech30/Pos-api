-- Add payment fields for cash + M-Pesa tracking

ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_tendered NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS change_given NUMERIC(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mpesa_phone TEXT;

-- Extend payment_method to allow 'mpesa'
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'mpesa'));