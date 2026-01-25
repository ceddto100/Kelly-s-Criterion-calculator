const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set. Configure it in the backend environment.');
}

const stripe = new Stripe(stripeSecretKey);

const STRIPE_PRICE_IDS = {
  core_access: process.env.STRIPE_PRICE_CORE
};

const getPriceIdForTier = (tier) => {
  const priceId = STRIPE_PRICE_IDS[tier];

  if (!priceId) {
    throw new Error(`Stripe price ID is missing for tier: ${tier}`);
  }

  return priceId;
};

module.exports = {
  stripe,
  STRIPE_PRICE_IDS,
  getPriceIdForTier
};
