import { cleanGtin, isValidGtin } from '../utils/gtin.js';

export function isValidPin(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

// Returns null if the barcode is acceptable, or an error message.
//
// A barcode doesn't have to be a valid GTIN — shops use custom codes for
// weighed items and internal SKUs. We only enforce the check digit when
// the length matches a known symbology (8/12/13/14).
export function validateBarcode(barcode) {
  if (barcode == null) return null;
  const digits = cleanGtin(barcode);
  if (digits.length === 0) return null;
  if (digits.length < 4) return 'Barcode must be at least 4 digits';
  if ([8, 12, 13, 14].includes(digits.length) && !isValidGtin(digits)) {
    return 'Barcode check digit is invalid';
  }
  return null;
}