const express = require('express');
const AppSetting = require('../models/AppSetting');
const { ensureAuthenticated } = require('../middleware/auth');
const { asyncHandler, UnauthorizedError } = require('../middleware/errorHandler');
const { isAdminEmail } = require('../config/admin');

const router = express.Router();

// Sports the admin can hide app-wide (e.g. when a season ends).
const MANAGED_SPORTS = ['NBA', 'NFL', 'MLB', 'NHL', 'CFB'];
const HIDDEN_SPORTS_KEY = 'hiddenSports';

async function readHiddenSports() {
  const doc = await AppSetting.findOne({ key: HIDDEN_SPORTS_KEY }).lean();
  const value = Array.isArray(doc?.value) ? doc.value : [];
  return value.filter((s) => MANAGED_SPORTS.includes(s));
}

// Public: the client needs this to decide which sports to show.
router.get('/', asyncHandler(async (_req, res) => {
  res.json({
    success: true,
    sports: MANAGED_SPORTS,
    hiddenSports: await readHiddenSports(),
  });
}));

// Admin: replace the list of hidden sports.
router.put('/hidden-sports', ensureAuthenticated, asyncHandler(async (req, res) => {
  if (!isAdminEmail(req.user?.email)) {
    throw new UnauthorizedError('Admin access required');
  }

  const requested = req.body?.hiddenSports;
  if (!Array.isArray(requested)) {
    return res.status(400).json({ success: false, error: 'hiddenSports must be an array' });
  }

  const unknown = requested.filter((s) => !MANAGED_SPORTS.includes(s));
  if (unknown.length) {
    return res.status(400).json({ success: false, error: `Unknown sport(s): ${unknown.join(', ')}` });
  }

  const hiddenSports = [...new Set(requested)];
  await AppSetting.findOneAndUpdate(
    { key: HIDDEN_SPORTS_KEY },
    { $set: { value: hiddenSports, updatedBy: req.user?.email || 'admin' } },
    { upsert: true, new: true }
  );

  res.json({ success: true, hiddenSports });
}));

module.exports = router;
