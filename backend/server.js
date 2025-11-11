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
// const { getTeamMatchupStats } = require('./espnService'); // <-- REMOVED THIS LINE

const SPORT_PATH_MAP = {
  nfl: { sport: 'football', league: 'nfl' },
  'college-football': { sport: 'football', league: 'college-football' },
  nba: { sport: 'basketball', league: 'nba' },
  wnba: { sport: 'basketball', league: 'wnba' },
  'mens-college-basketball': { sport: 'basketball', league: 'mens-college-basketball' },
  'womens-college-basketball': { sport: 'basketball', league: 'womens-college-basketball' },
  mlb: { sport: 'baseball', league: 'mlb' },
  nhl: { sport: 'hockey', league: 'nhl' },
};

function resolveSportPath(rawSport) {
  if (!rawSport || typeof rawSport !== 'string') return null;
  const trimmed = rawSport.trim().toLowerCase();
  if (trimmed.includes('/')) {
    const [sport, league] = trimmed.split('/').map((part) => part.trim()).filter(Boolean);
    if (sport && league) {
      return { sport, league };
    }
  }
  if (SPORT_PATH_MAP[trimmed]) {
    return SPORT_PATH_MAP[trimmed];
  }
  return null;
}

function normalizeString(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestTeamMatch(teams, targetName) {
  if (!Array.isArray(teams)) return null;
  const normalizedTarget = normalizeString(targetName);

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of teams) {
    const team = entry?.team;
    if (!team) continue;

    const candidates = [team.displayName, team.name, team.shortDisplayName, team.abbreviation, team.nickname]
      .filter(Boolean)
      .map(normalizeString);

    for (const candidate of candidates) {
      if (!candidate) continue;
      if (candidate === normalizedTarget) {
        return team;
      }
      const overlap = candidate.split(' ').filter((word) => normalizedTarget.includes(word)).length;
      if (overlap > bestScore) {
        bestScore = overlap;
        bestMatch = team;
      }
    }
  }

  if (!bestMatch && teams.length) {
    return teams[0].team;
  }

  return bestMatch;
}

const app = express();

// ==================== MIDDLEWARE ====================

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  allowedHeaders: ['Content-Type', 'x-user-id', 'x-admin-key']
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

app.post('/api/game-search', asyncHandler(async (req, res) => {
  const { team_1, team_2, sport, season } = req.body || {};

  if (![team_1, team_2, sport, season].every((value) => typeof value === 'string' && value.trim().length > 0)) {
    return res.status(400).json({ message: 'Missing required fields: team_1, team_2, sport, season.' });
  }

  const sportPath = resolveSportPath(sport);
  if (!sportPath) {
    return res.status(400).json({ message: 'Unsupported sport. Provide a value like "nfl" or "football/nfl".' });
  }

  const seasonYear = parseInt(season, 10);
  if (Number.isNaN(seasonYear)) {
    return res.status(400).json({ message: 'Season must be a numeric year.' });
  }

  const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/${sportPath.sport}/${sportPath.league}`;

  const teamsResponse = await fetch(`${baseUrl}/teams?limit=1000`);
  if (!teamsResponse.ok) {
    throw new Error(`Failed to fetch teams from ESPN (${teamsResponse.status})`);
  }
  const teamsPayload = await teamsResponse.json();
  const teams = teamsPayload?.sports?.[0]?.leagues?.[0]?.teams;

  const teamOne = findBestTeamMatch(teams, team_1);
  const teamTwo = findBestTeamMatch(teams, team_2);

  if (!teamOne || !teamTwo) {
    return res.status(404).json({ message: 'Could not match one or both teams on ESPN.' });
  }

  const scheduleResponse = await fetch(`${baseUrl}/teams/${teamOne.id}/schedule?season=${seasonYear}&seasontype=2`);
  if (!scheduleResponse.ok) {
    throw new Error(`Failed to fetch schedule from ESPN (${scheduleResponse.status})`);
  }
  const schedulePayload = await scheduleResponse.json();
  const events = schedulePayload?.events || [];

  const matchingEvent = events.find((event) => {
    const competition = event?.competitions?.[0];
    if (!competition?.competitors) return false;
    return competition.competitors.some((competitor) => competitor?.team?.id === teamTwo.id);
  });

  if (!matchingEvent) {
    return res.status(404).json({ message: 'No matching game found for the provided teams and season.' });
  }

  const competition = matchingEvent.competitions?.[0];
  const competitors = competition?.competitors || [];
  const competitorDetails = competitors.map((competitor) => ({
    id: competitor?.team?.id,
    name: competitor?.team?.displayName,
    abbreviation: competitor?.team?.abbreviation,
    logo: competitor?.team?.logo,
    score: competitor?.score,
    winner: competitor?.winner,
    record: competitor?.records?.[0]?.summary,
  }));

  const notes = competition?.notes?.map((note) => note?.headline || note?.text).filter(Boolean) || [];
  const odds = competition?.odds?.[0];

  const responsePayload = {
    success: true,
    game: {
      id: matchingEvent.id,
      date: matchingEvent.date,
      status: competition?.status?.type?.detail || competition?.status?.type?.description,
      venue: competition?.venue?.fullName,
      location: [competition?.venue?.address?.city, competition?.venue?.address?.state].filter(Boolean).join(', '),
      season: matchingEvent.season?.year,
      teams: competitorDetails,
      headline: matchingEvent.name,
      notes,
      odds: odds
        ? {
            details: odds.details,
            overUnder: odds.overUnder,
            spread: odds.spread,
            favorite: odds.favorite?.displayName,
          }
        : null,
      links: matchingEvent.links?.filter((link) => Array.isArray(link.rel) && link.rel.includes('summary')).map((link) => ({
        text: link.text,
        href: link.href,
      })),
    },
    requested: { team_1, team_2, sport: sportPath, season: seasonYear },
  };

  res.json(responsePayload);
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
