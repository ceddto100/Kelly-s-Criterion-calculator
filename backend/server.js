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
const { getTeamMatchupStats } = require('./espnService');

// Import AI SDKs
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

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

// Get Team Matchup Stats (ESPN Integration)
app.post('/get_team_matchup_stats', asyncHandler(async (req, res) => {
  const { sport, team_1, team_2, season, metrics } = req.body;

  // Validate required parameters
  if (!sport || !team_1 || !team_2) {
    return res.status(400).json({
      error: 'Missing required parameters',
      required: ['sport', 'team_1', 'team_2'],
      received: { sport, team_1, team_2 }
    });
  }

  // Validate sport
  if (!['NBA', 'NFL'].includes(sport.toUpperCase())) {
    return res.status(400).json({
      error: 'Invalid sport',
      message: 'Sport must be either "NBA" or "NFL"',
      received: sport
    });
  }

  try {
    logger.info('Fetching team matchup stats', {
      sport: sport.toUpperCase(),
      team_1,
      team_2,
      season: season || 'current'
    });

    // Fetch stats from ESPN
    const matchupData = await getTeamMatchupStats({
      sport: sport.toUpperCase(),
      team_1,
      team_2,
      season: season || 'current'
    });

    // Log success
    logger.info('Successfully fetched team matchup stats', {
      sport: matchupData.sport,
      teams: matchupData.teams
    });

    res.json(matchupData);
  } catch (error) {
    logger.error('Error fetching team matchup stats', {
      error: error.message,
      sport,
      team_1,
      team_2
    });

    // Handle specific error cases
    if (error.message.includes('Team not found')) {
      return res.status(404).json({
        error: 'Team not found',
        message: error.message,
        suggestion: 'Please check team names and try again'
      });
    }

    if (error.message.includes('Failed to fetch')) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'ESPN API is temporarily unavailable. Please try again later.'
      });
    }

    // Generic error response
    res.status(500).json({
      error: 'Failed to fetch team matchup stats',
      message: error.message
    });
  }
}));

// AI-Powered Matchup Analysis (OpenAI or Claude)
app.post('/api/matchup',
  validateUserIdentifier,
  validateRequest('matchup'),
  asyncHandler(async (req, res) => {
    const { sport, team1, team2, season, provider } = req.validatedData;

    logger.info('AI matchup analysis requested', {
      sport,
      team1,
      team2,
      season: season || 'current',
      provider
    });

    // Choose AI provider
    let data;
    try {
      if (provider === 'claude') {
        data = await getStatsWithClaude({ sport, team1, team2, season: season || 'current' });
      } else {
        data = await getStatsWithOpenAI({ sport, team1, team2, season: season || 'current' });
      }

      logger.info('AI matchup analysis completed', {
        provider,
        sport,
        teams: `${team1} vs ${team2}`
      });

      res.json({
        success: true,
        provider,
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('AI matchup analysis failed', {
        error: error.message,
        provider,
        sport,
        team1,
        team2
      });

      // Handle specific error cases
      if (error.message.includes('API key')) {
        return res.status(500).json({
          error: 'AI service configuration error',
          message: 'The AI service is not properly configured. Please contact support.'
        });
      }

      if (error.message.includes('rate limit')) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many requests to the AI service. Please try again later.'
        });
      }

      throw error;
    }
  })
);

// ==================== AI HELPER FUNCTIONS ====================

/**
 * Fetch sports matchup stats using OpenAI Responses API
 */
async function getStatsWithOpenAI({ sport, team1, team2, season }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const openai = new OpenAI({ apiKey });

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a sports statistics expert. Provide structured JSON data with comprehensive stats for sports matchups. Include team performance metrics, head-to-head history, recent form, key player stats, and betting insights. Always return valid JSON.`
        },
        {
          role: 'user',
          content: `Get detailed stats for ${team1} vs ${team2} in ${sport} for the ${season} season. Include:
- Team records and standings
- Head-to-head history
- Recent performance (last 5-10 games)
- Key player statistics
- Home/away splits
- Injury reports
- Betting trends and insights
- Kelly Criterion recommendations based on the data

Return as structured JSON.`
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const output = response.choices[0]?.message?.content;
    if (!output) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    try {
      return JSON.parse(output);
    } catch (parseError) {
      logger.warn('OpenAI returned non-JSON response, returning raw text', { output });
      return { raw: output, warning: 'Response was not valid JSON' };
    }
  } catch (error) {
    logger.error('OpenAI API error', {
      error: error.message,
      status: error.status,
      code: error.code
    });

    if (error.status === 429) {
      throw new Error('OpenAI rate limit exceeded');
    }
    if (error.status === 401) {
      throw new Error('Invalid OpenAI API key');
    }

    throw new Error(`OpenAI service error: ${error.message}`);
  }
}

/**
 * Fetch sports matchup stats using Claude (Anthropic)
 */
async function getStatsWithClaude({ sport, team1, team2, season }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const prompt = `Get detailed sports matchup statistics for ${team1} vs ${team2} in ${sport} for the ${season} season.

Please provide comprehensive analysis including:
- Team records and current standings
- Head-to-head history and trends
- Recent performance (last 5-10 games)
- Key player statistics and matchups
- Home/away performance splits
- Current injury reports
- Historical betting trends
- Kelly Criterion betting recommendations

Format your response as structured JSON with clear sections for each category.`;

    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      temperature: 0.2,
      system: 'You are a sports statistics expert. Provide comprehensive, accurate sports matchup data in structured JSON format. Include team performance metrics, head-to-head history, recent form, key player stats, and betting insights.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const output = message.content[0]?.text;
    if (!output) {
      throw new Error('No response from Claude');
    }

    // Try to parse as JSON
    try {
      return JSON.parse(output);
    } catch (parseError) {
      // Claude might wrap JSON in markdown code blocks
      const jsonMatch = output.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      logger.warn('Claude returned non-JSON response, returning raw text', { output });
      return { raw: output, warning: 'Response was not valid JSON' };
    }
  } catch (error) {
    logger.error('Claude API error', {
      error: error.message,
      status: error.status,
      type: error.type
    });

    if (error.status === 429) {
      throw new Error('Claude rate limit exceeded');
    }
    if (error.status === 401) {
      throw new Error('Invalid Anthropic API key');
    }

    throw new Error(`Claude service error: ${error.message}`);
  }
}

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