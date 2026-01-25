const mongoose = require('mongoose');
const { User } = require('../config/database');
const { UnauthorizedError } = require('../middleware/errorHandler');

const FREE_MONTHLY_CALCULATIONS = 3;
const UNLIMITED_EMAILS = new Set(['cartercedrick35@gmail.com']);
const normalizeEmail = (value) => (value || '').trim().toLowerCase();

const isSameMonth = (dateA, dateB) => (
  dateA.getFullYear() === dateB.getFullYear()
  && dateA.getMonth() === dateB.getMonth()
);

/**
 * Determine whether a user can run a calculation.
 * - Subscribed users are always allowed.
 * - Unsubscribed users get 3 calculations per calendar month.
 */
async function canUserCalculate(userIdentifier) {
  if (!userIdentifier) {
    throw new UnauthorizedError('Authentication required to calculate');
  }

  let user = await User.findOne({ identifier: userIdentifier });

  if (!user && mongoose.Types.ObjectId.isValid(userIdentifier)) {
    user = await User.findById(userIdentifier);
  }

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  const isUnlimited = UNLIMITED_EMAILS.has(normalizeEmail(user.email));

  if (isUnlimited) {
    return { allowed: true, reason: null, user, isUnlimited };
  }

  if (user.isSubscribed) {
    return { allowed: true, reason: null, user, isUnlimited: false };
  }

  const now = new Date();
  const lastReset = user.lastResetDate ? new Date(user.lastResetDate) : now;

  if (!isSameMonth(now, lastReset)) {
    user.calculationsUsedThisMonth = 0;
    user.lastResetDate = now;
  }

  if (user.calculationsUsedThisMonth >= FREE_MONTHLY_CALCULATIONS) {
    await user.save();
    return {
      allowed: false,
      reason: 'Monthly calculation limit reached',
      user,
      isUnlimited: false
    };
  }

  user.calculationsUsedThisMonth += 1;
  await user.save();

  return { allowed: true, reason: null, user, isUnlimited: false };
}

module.exports = {
  canUserCalculate
};
