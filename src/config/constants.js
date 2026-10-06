// Application constants. Anything that could plausibly change — a
// business rule, a rate, a limit — lives here rather than inline in
// the file that happens to need it. When a value changes, this is
// the only file that should need editing.

// ─── Payment ────────────────────────────────────────────────
export const PAYMENT_METHODS = ['cash', 'card', 'mpesa', 'mpesa_stk'];

// ─── Staff / auth ───────────────────────────────────────────
export const PIN_LENGTH = 4;
export const JWT_EXPIRES_IN = '30d';
export const MIN_PASSWORD_LENGTH = 6;

// ─── Stock ──────────────────────────────────────────────────
export const STOCK_ADJUST_REASONS = [
  'restock',
  'correction',
  'damage',
  'return',
];

// ─── Tax (Kenya) ────────────────────────────────────────────
// Standard VAT rate. Shops can override on their record; this is
// the fallback when they haven't.
export const DEFAULT_VAT_RATE = 16;
export const MAX_VAT_RATE = 50;

// Turnover Tax — flat 1.5% of gross for shops under the VAT
// threshold. Not charged to customers; it's the shop's own
// liability.
export const TOT_RATE = 1.5;

// ─── M-Pesa / STK Push ──────────────────────────────────────
// How long an STK order stays 'pending' before the sweeper marks
// it failed.
export const STK_TIMEOUT_MINUTES = 2;
export const STK_SWEEP_INTERVAL_MS = 60_000;
