-- STK Push tracking

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mpesa_checkout_request_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mpesa_receipt_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mpesa_result_code INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mpesa_result_desc TEXT;

-- Allow 'mpesa_stk' as a payment method
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'mpesa', 'mpesa_stk'));