import express from 'express';
import { shiftDb, shapeShift } from '../db/shifts.js';
import { userDb } from '../db/users.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Resolve the staff id: if the client sends one, validate it belongs to
// the caller's shop and is active; otherwise use the logged-in user.
async function resolveStaffId(req, providedStaffId) {
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

router.get('/current', requireAuth, asyncHandler(async (req, res) => {
  const row = await shiftDb.findCurrent(req.user.shopId);
  if (!row) return res.json({ shift: null });
  const report = row.status === 'closed'
    ? await shiftDb.getReport(row.id, req.user.shopId)
    : null;
  res.json({ shift: shapeShift(row), report });
}));

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const shifts = await shiftDb.list(req.user.shopId);
  res.json({ shifts });
}));

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const row = await shiftDb.findById(req.params.id, req.user.shopId);
  if (!row) return res.status(404).json({ message: 'Shift not found' });
  const report = await shiftDb.getReport(row.id, req.user.shopId);
  res.json({ shift: shapeShift(row), report });
}));

router.post('/open', requireAuth, asyncHandler(async (req, res) => {
  const { openingFloat, staffId: providedStaffId } = req.body;
  const staffId = await resolveStaffId(req, providedStaffId);
  const shift = await shiftDb.open({
    shopId: req.user.shopId,
    staffId,
    openingFloat: openingFloat != null ? Number(openingFloat) : null,
  });
  res.status(201).json({ shift });
}));

router.post('/:id/close', requireAuth, asyncHandler(async (req, res) => {
  const { countedCash, notes } = req.body;
  const result = await shiftDb.close(req.params.id, req.user.shopId, {
    countedCash: countedCash != null ? Number(countedCash) : null,
    notes: notes || null,
  });
  if (!result) return res.status(404).json({ message: 'Shift not found' });
  res.json(result);
}));

export default router;