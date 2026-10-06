import express from 'express';
import { shiftDb } from '../db/shifts.js';
import { shapeShift } from '../serializers/shift.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { resolveStaffId } from '../lib/resolveStaffId.js';

const router = express.Router();

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