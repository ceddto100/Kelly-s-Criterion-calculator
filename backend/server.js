// server.js - Main Express Server for Betting Calculator (Improved)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import custom modules
const { connectDatabase, checkDatabaseHealth, User, Calculation, Transaction } = require('./config/database');
const { validateRequest, validateUserIdentifier } = require('./middleware/validation');
const {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  setupGracefulShutdown,
  logger,
  UnauthorizedError,
  RateLimitError
} = require('./middleware/errorHandler');

const app = express();

// ==================== MIDDLEWARE ====================

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Body parser with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Request logging middleware (simple version)
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// ==================== CONSTANTS ====================

const FREE_DAILY_CALCULATIONS = 10;
const TOKEN_COST_PER_CALCULATION = 1;
const TOKEN_PACKAGES = {
  starter: { tokens: 50, price: 4.99 },
  premium: { tokens: 150, price: 12.99 },
  pro: { tokens: 500, price: 39.99 }
};

// ==================== HELPER FUNCTIONS ====================

// Get or Create User
async function getOrCreateUser(identifier) {
  let user = await User.findOne({ identifier });

  if (!user) {
    user = new User({ identifier, tokens: 5 }); // 5 welcome tokens
    await user.save();
    logger.info('New user created', { identifier });
  } else {
    // Reset daily calculations if new day
    user.resetDailyCalculationsIfNeeded();
    user.lastActive = new Date();
    await user.save();
  }

  return user;
}

// ==================== ROUTES ====================

// Health Check
app.get('/health', asyncHandler(async (req, res) => {
  const dbHealth = await checkDatabaseHealth();

  const health = {
    status: dbHealth.status === 'healthy' ? 'ok' : 'degraded',
    timestamp: new Date(),
    database: dbHealth,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
}));

// Get User Status
app.get('/api/user/status', validateUserIdentifier, asyncHandler(async (req, res) => {
  const user = await getOrCreateUser(req.userIdentifier);

  const freeRemaining = Math.max(0, FREE_DAILY_CALCULATIONS - user.dailyCalculations);

  res.json({
    tokens: user.tokens,
    freeCalculationsRemaining: freeRemaining,
    totalCalculations: user.totalCalculations,
    isPremium: user.isPremium,
    dailyLimit: FREE_DAILY_CALCULATIONS
  });
}));

// Perform Calculation (with token/free check)
app.post('/api/calculate',
  validateUserIdentifier,
  validateRequest('calculate'),
  asyncHandler(async (req, res) => {
    const { prompt, systemInstruction, calculationType } = req.validatedData;

    const user = await getOrCreateUser(req.userIdentifier);
    const canCalc = user.canPerformCalculation();

    if (!canCalc.allowed) {
      return res.status(403).json({
        error: canCalc.reason,
        needsTokens: true,
        tokens: user.tokens,
        freeRemaining: 0
      });
    }

    // Deduct tokens or increment daily count
    let tokensUsed = 0;
    let isFree = false;

    if (canCalc.useFree) {
      user.dailyCalculations += 1;
      isFree = true;
    } else if (!user.isPremium) {
      user.tokens -= TOKEN_COST_PER_CALCULATION;
      tokensUsed = TOKEN_COST_PER_CALCULATION;
    }

    user.totalCalculations += 1;
    await user.save();

    // Log the calculation
    await new Calculation({
      userId: user._id,
      calculationType,
      tokensUsed,
      isFree
    }).save();

    // Call Gemini API
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.2
          }
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('Gemini API Error', { status: response.status, error: errorData });
      throw new Error('AI service temporarily unavailable');
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('Invalid response from AI service');
    }

    res.json({
      text: responseText,
      tokensUsed,
      isFree,
      remainingTokens: user.tokens,
      freeRemaining: Math.max(0, FREE_DAILY_CALCULATIONS - user.dailyCalculations)
    });
  })
);

// Purchase Tokens
app.post('/api/tokens/purchase',
  validateUserIdentifier,
  validateRequest('tokenPurchase'),
  asyncHandler(async (req, res) => {
    const { package: packageType, paymentIntentId } = req.validatedData;

    const user = await getOrCreateUser(req.userIdentifier);

    const selectedPackage = TOKEN_PACKAGES[packageType];
    if (!selectedPackage) {
      return res.status(400).json({ error: 'Invalid package type' });
    }

    // TODO: In production, verify payment with Stripe here
    // const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    // if (paymentIntent.status !== 'succeeded') {
    //   throw new Error('Payment not completed');
    // }

    user.tokens += selectedPackage.tokens;
    await user.save();

    // Log transaction
    await new Transaction({
      userId: user._id,
      amount: selectedPackage.price,
      tokens: selectedPackage.tokens,
      paymentId: paymentIntentId || 'simulated',
      status: 'completed'
    }).save();

    logger.info('Token purchase completed', {
      userId: user._id,
      package: packageType,
      tokens: selectedPackage.tokens
    });

    res.json({
      success: true,
      newBalance: user.tokens,
      tokensAdded: selectedPackage.tokens
    });
  })
);

// Watch Ad (get bonus tokens)
app.post('/api/tokens/watch-ad',
  validateUserIdentifier,
  validateRequest('watchAd'),
  asyncHandler(async (req, res) => {
    const { adId } = req.validatedData;

    const user = await getOrCreateUser(req.userIdentifier);

    // Limit ads per day
    const today = new Date().setHours(0, 0, 0, 0);
    const adsWatchedToday = await Calculation.countDocuments({
      userId: user._id,
      calculationType: 'ad',
      timestamp: { $gte: today }
    });

    if (adsWatchedToday >= 5) {
      throw new RateLimitError('Daily ad limit reached (5 ads per day)');
    }

    // TODO: Verify ad was actually watched with ad network

    // Award tokens for watching ad
    const adReward = 2;
    user.tokens += adReward;
    await user.save();

    await new Calculation({
      userId: user._id,
      calculationType: 'ad',
      tokensUsed: -adReward,
      isFree: true
    }).save();

    logger.info('Ad watch reward granted', {
      userId: user._id,
      adId,
      reward: adReward
    });

    res.json({
      success: true,
      tokensEarned: adReward,
      newBalance: user.tokens,
      adsRemaining: 5 - adsWatchedToday - 1
    });
  })
);

// Get User History
app.get('/api/user/history',
  validateUserIdentifier,
  asyncHandler(async (req, res) => {
    const user = await getOrCreateUser(req.userIdentifier);

    const calculations = await Calculation.find({ userId: user._id })
      .sort({ timestamp: -1 })
      .limit(50)
      .select('-__v')
      .lean();

    res.json({ calculations });
  })
);

// Admin: Get Stats
app.get('/api/admin/stats', asyncHandler(async (req, res) => {
  const adminKey = req.headers['x-admin-key'];

  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    throw new UnauthorizedError('Invalid or missing admin key');
  }

  const [totalUsers, totalCalculations, totalRevenue, activeToday] = await Promise.all([
    User.countDocuments(),
    Calculation.countDocuments(),
    Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    User.countDocuments({
      lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
  ]);

  res.json({
    totalUsers,
    totalCalculations,
    totalRevenue: totalRevenue[0]?.total || 0,
    activeToday
  });
}));

// ==================== ERROR HANDLING ====================

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// ==================== SERVER STARTUP ====================

async function startServer() {
  try {
    // Connect to database first
    await connectDatabase();

    // Start server
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        port: PORT
      });
    });

    // Setup graceful shutdown
    setupGracefulShutdown(server, require('./config/database').mongoose);

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;
