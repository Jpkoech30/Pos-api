import { shopDb } from '../db/shops.js';
import { shiftDb } from '../db/shifts.js';
import { orderDb } from '../db/orders.js';
import { resolveStaffId } from '../lib/resolveStaffId.js';

// Read the shop's tax config and normalize it for order creation.
// vatRate is 0 for non-VAT shops so the math inside orderDb.create
// collapses to "no tax" without special-casing there.
export function taxConfigFor(shop) {
  const vatRegistered = shop?.vat_registered === true;
  return {
    vatRate: vatRegistered ? Number(shop.vat_rate) : 0,
    taxInclusive: shop?.prices_include_vat !== false,
  };
}

// Create an order for the caller's shop, applying the shop's tax
// config, resolving the effective staff member, and tagging the
// order with whatever shift is currently open (if any).
//
// All three payment paths — cash, Pochi, STK Push — go through here
// so the rules are consistent no matter how the sale is paid for.
//
// The route layer's job is to validate the request and pass the
// parsed inputs. Everything else about order creation lives here.
export async function createOrder(req, {
  items,
  paymentMethod,
  providedStaffId = null,
  amountTendered = null,
  changeGiven = null,
  mpesaPhone = null,
  paymentStatus = 'completed',
  idempotencyKey = null,
}) {
  const shop = await shopDb.findById(req.user.shopId);
  const { vatRate, taxInclusive } = taxConfigFor(shop);

  const staffId = await resolveStaffId(req, providedStaffId);

  const currentShift = await shiftDb.findCurrent(req.user.shopId);
  const shiftId = currentShift ? currentShift.id : null;

  return orderDb.create({
    shopId: req.user.shopId,
    staffId,
    shiftId,
    items,
    paymentMethod,
    vatRate,
    taxInclusive,
    amountTendered,
    changeGiven,
    mpesaPhone,
    paymentStatus,
    idempotencyKey,
  });
}