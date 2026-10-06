import { userDb } from '../db/users.js';

// Resolve the effective staff id for an action.
//
// If the client sends a staffId, verify it belongs to the caller's shop
// and is active; otherwise fall back to the logged-in user. Any lookup
// failure also falls back, so an invalid id can never cause a 500.
export async function resolveStaffId(req, providedStaffId) {
  if (!providedStaffId) return req.user.id;
  try {
    const staff = await userDb.findById(providedStaffId);
    if (staff && staff.is_active && String(staff.shop_id) === String(req.user.shopId)) {
      return staff.id;
    }
  } catch (err) {
    console.warn('Staff id validation failed:', err.message);
  }
  return req.user.id;
}