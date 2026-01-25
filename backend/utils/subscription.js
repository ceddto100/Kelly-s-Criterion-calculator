const { User } = require('../config/database');
const { UnauthorizedError } = require('../middleware/errorHandler');

const FREE_MONTHLY_CALCULATIONS = 3;

const isSameMonth = (dateA, dateB) => (
  dateA.getFullYear() === dateB.getFullYear()
  && dateA.getMonth() === dateB.getMonth()
);

/**
 * Determine whether a user can run a calculation.
 * - Subscribed users are always allowed.
 * - Unsubscribed users get 3 calculations per calendar month.
 */
async function canUserCalculate(userId) {
  if (!userId) {
    throw new UnauthorizedError('Authentication required to calculate');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  if (user.isSubscribed) {
    return { allowed: true, reason: null, user };
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
      user
    };
  }

  user.calculationsUsedThisMonth += 1;
  await user.save();

  return { allowed: true, reason: null, user };
}

module.exports = {
  canUserCalculate
};
