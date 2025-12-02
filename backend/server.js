// server.js - Main Express Server for Betting Calculator (Improved)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('passport');
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

// Import authentication modules
const { ensureAuthenticated } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const betsRoutes = require('./routes/bets');

// Sports Scraper Routes
const offense = require('./scrapers/offense');
const defense = require('./scrapers/defense');
const differential = require('./scrapers/differential');
const matchup = require('./scrapers/matchup');
const { analyzeMatchupRoute } = require('./gemini/chat');
const { fetchNBATeamStats, findTeamByName } = require('./scrapers/nbaStatsApi');

// Configure Passport
require('./config/passport')(passport);

const app = express();

// ==================== MIDDLEWARE ====================

// Security middleware
app.use(helmet());

// Trust proxy - required for Render deployment to correctly identify client IP and protocol
app.set('trust proxy', 1);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://betgistics.com',
  credentials: true,
  allowedHeaders: ['Content-Type', 'x-user-id', 'x-admin-key']
}));

// Body parser with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== SESSION & AUTHENTICATION ====================
// Session configuration for Google OAuth
// IMPORTANT: SESSION_SECRET must be set in .env file
const determineCookieDomain = () => {
  // Allow explicit override via env
  if (process.env.SESSION_COOKIE_DOMAIN) return process.env.SESSION_COOKIE_DOMAIN;

  // Derive from FRONTEND_URL when possible so the cookie is shared across subdomains
  try {
    const frontendUrl = new URL(process.env.FRONTEND_URL || 'https://betgistics.com');
    const hostname = frontendUrl.hostname;

    // If the hostname already contains subdomain parts, strip to the registrable domain
    const hostParts = hostname.split('.');
    if (hostParts.length >= 2) {
      return `.${hostParts.slice(-2).join('.')}`; // e.g. betgistics.com -> .betgistics.com
    }
  } catch (error) {
    logger.warn('Unable to derive session cookie domain from FRONTEND_URL', { error });
  }

  // Fallback to undefined which lets the browser default to the API host
  return undefined;
};

// Always use SameSite=None + Secure for cross-site OAuth flows (API is on api.betagistics.com)
// This avoids the login session being dropped when NODE_ENV is misconfigured
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // Required when SameSite is 'none'
    httpOnly: true,
    domain: determineCookieDomain(),
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'none'
  }
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

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

// ==================== SIMPLE CALCULATE ENDPOINT (NO AUTH) ====================
// This is the simple version from calculate.js - no authentication or token tracking
app.post('/api/calculate', asyncHandler(async (req, res) => {
  // 1. We only accept POST requests (already handled by Express routing)
  
  // 2. Get the prompt data from the frontend
  const { prompt, systemInstruction } = req.body;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!prompt || !systemInstruction) {
    return res.status(400).json({ message: 'Missing prompt or system instruction.' });
  }

  if (!geminiApiKey) {
    return res.status(500).json({ message: 'API key not configured on the server.' });
  }

  // 3. Call the actual Gemini API from the secure server
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
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
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('Gemini API Error', { status: response.status, error: errorData });
      throw new Error(`Google API failed with status: ${response.status}`);
    }

    const data = await response.json();
    
    // 4. Send the result back to the frontend
    // The response is complex, we need to extract the text part
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      throw new Error('Invalid response from AI service');
    }
    
    res.status(200).json({ text: responseText });

  } catch (error) {
    logger.error('Internal Server Error:', error);
    res.status(500).json({ message: 'An error occurred while contacting the AI model.' });
  }
}));

// ==================== AUTHENTICATED CALCULATE ENDPOINT (WITH TOKENS) ====================
// Keep this as backup or for premium features
app.post('/api/calculate-premium',
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

// ==================== AUTHENTICATION ROUTES ====================

// Mount authentication routes
app.use('/auth', authRoutes);
app.use('/api/bets', betsRoutes);

// Protected Dashboard Route - displays logged-in user information
app.get('/dashboard', ensureAuthenticated, (req, res) => {
  res.json({
    message: 'Welcome to your dashboard!',
    user: {
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      googleId: req.user.googleId
    }
  });
});

// ==================== SPORTS SCRAPER ROUTES ====================

// Get offensive stats (Points Per Game)
app.get('/api/offense', asyncHandler(offense));

// Get defensive stats (Points Allowed)
app.get('/api/defense', asyncHandler(defense));

// Get differential stats (Rebound & Turnover Margins)
app.get('/api/differential', asyncHandler(differential));

// Get matchup comparison for two teams
app.get('/api/matchup', asyncHandler(matchup));

// Get AI-powered matchup analysis using Groq
app.get('/api/analyze', asyncHandler(analyzeMatchupRoute));

// Health check for sports API
app.get('/api/sports/health', asyncHandler(async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };

  // Test ESPN API
  try {
    const teams = await fetchNBATeamStats();
    results.tests.espnApi = {
      status: 'healthy',
      teams: teams.length,
      message: 'ESPN API is accessible'
    };
  } catch (error) {
    results.tests.espnApi = {
      status: 'unhealthy',
      error: error.message
    };
  }

  // Test Gemini
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    results.tests.gemini = {
      status: geminiKey ? 'configured' : 'unconfigured',
      message: geminiKey ? 'Gemini API key is set' : 'Gemini API key missing'
    };
  } catch (error) {
    results.tests.gemini = {
      status: 'error',
      error: error.message
    };
  }

  const overallHealth = Object.values(results.tests).every(
    test => test.status === 'healthy' || test.status === 'configured'
  );

  res.status(overallHealth ? 200 : 503).json({
    status: overallHealth ? 'healthy' : 'degraded',
    ...results
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
    const NODE_ENV = process.env.NODE_ENV || 'production'; // Default to production instead
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        environment: NODE_ENV,
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
