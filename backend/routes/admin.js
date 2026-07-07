const express = require('express');
const { User } = require('../config/database');
const { ensureAuthenticated } = require('../middleware/auth');
const { asyncHandler, UnauthorizedError } = require('../middleware/errorHandler');
const { isAdminEmail } = require('../config/admin');

const router = express.Router();

router.post(
  '/reset-free-calculations',
  ensureAuthenticated,
  asyncHandler(async (req, res) => {
    if (!isAdminEmail(req.user?.email)) {
      throw new UnauthorizedError('Admin access required');
    }

    const now = new Date();

    const result = await User.updateMany(
      { isSubscribed: false },
      {
        $set: {
          calculationsUsedThisMonth: 0,
          lastResetDate: now
        }
      }
    );

    res.json({
      success: true,
      matched: result.matchedCount ?? result.n,
      modified: result.modifiedCount ?? result.nModified,
      resetAt: now.toISOString()
    });
  })
);

module.exports = router;
