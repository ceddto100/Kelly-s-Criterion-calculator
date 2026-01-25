const express = require('express');
const { User } = require('../config/database');
const { asyncHandler, logger } = require('../middleware/errorHandler');
const { ensureAuthenticated } = require('../middleware/auth');
const { stripe, getPriceIdForTier } = require('../config/stripe');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://betgistics.com';
const SUBSCRIPTION_TIER = 'core_access';

const resolveCheckoutEmail = (session) => (
  session.customer_details?.email || session.customer_email || null
);

const isActiveSubscription = (subscription) => (
  subscription.status === 'active' || subscription.status === 'trialing'
);

router.post(
  '/create-checkout-session',
  ensureAuthenticated,
  asyncHandler(async (req, res) => {
    const email = req.user?.email;

    if (!email) {
      return res.status(400).json({ error: 'Authenticated user email is missing' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const priceId = getPriceIdForTier(SUBSCRIPTION_TIER);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      success_url: `${FRONTEND_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/?checkout=cancelled`,
      subscription_data: {
        metadata: {
          tier: SUBSCRIPTION_TIER,
          product: 'betgistics',
          monthly_calculation_limit: 'unlimited'
        }
      },
      metadata: {
        userId: user._id.toString(),
        tier: SUBSCRIPTION_TIER,
        product: 'betgistics'
      }
    });

    return res.json({ url: session.url, sessionId: session.id });
  })
);

router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return res.status(400).send('Stripe webhook signature missing');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (error) {
      logger.warn('Stripe webhook signature verification failed', { error: error.message });
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = resolveCheckoutEmail(session);

        if (!email) {
          logger.warn('Checkout session completed without customer email', {
            sessionId: session.id
          });
          break;
        }

        await User.findOneAndUpdate(
          { email },
          {
            isSubscribed: true,
            subscriptionTier: SUBSCRIPTION_TIER,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription
          },
          { new: true }
        );
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const subscribed = isActiveSubscription(subscription);

        await User.findOneAndUpdate(
          { stripeCustomerId: subscription.customer },
          {
            isSubscribed: subscribed,
            subscriptionTier: subscribed ? SUBSCRIPTION_TIER : null,
            stripeSubscriptionId: subscription.id
          },
          { new: true }
        );
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;

        await User.findOneAndUpdate(
          { stripeCustomerId: subscription.customer },
          {
            isSubscribed: false,
            subscriptionTier: null,
            stripeSubscriptionId: null
          },
          { new: true }
        );
        break;
      }
      default:
        logger.info('Unhandled Stripe event type', { type: event.type });
    }

    return res.json({ received: true });
  })
);

module.exports = router;
