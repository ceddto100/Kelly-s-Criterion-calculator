// server.js - Main Express Server for Betting Calculator
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use(limiter);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  identifier: { type: String, required: true, unique: true }, // IP or user ID
  tokens: { type: Number, default: 0 },
  dailyCalculations: { type: Number, default: 0 },
  lastResetDate: { type: Date, default: Date.now },
  totalCalculations: { type: Number, default: 0 },
  isPremium: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Calculation Log Schema
const calculationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  calculationType: { type: String, enum: ['kelly', 'probability', 'unit'], required: true },
  tokensUsed: { type: Number, default: 0 },
  isFree: { type: Boolean, default: true },
  timestamp: { type: Date, default: Date.now }
});

const Calculation = mongoose.model('Calculation', calculationSchema);

// Transaction Schema (for token purchases)
const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, required: true },
  tokens: { type: Number, required: true },
  paymentId: String,
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

// Constants
const FREE_DAILY_CALCULATIONS = 10;
const TOKEN_COST_PER_CALCULATION = 1;

// Helper: Get or Create User
async function getOrCreateUser(identifier) {
  let user = await User.findOne({ identifier });
  
  if (!user) {
    user = new User({ identifier, tokens: 5 }); // 5 welcome tokens
    await user.save();
  } else {
    // Reset daily calculations if new day
    const today = new Date().setHours(0, 0, 0, 0);
    const lastReset = new Date(user.lastResetDate).setHours(0, 0, 0, 0);
    
    if (today > lastReset) {
      user.dailyCalculations = 0;
      user.lastResetDate = new Date();
    }
    
    user.lastActive = new Date();
    await user.save();
  }
  
  return user;
}

// Helper: Check if calculation is allowed
function canPerformCalculation(user) {
  const hasFreeCals = user.dailyCalculations < FREE_DAILY_CALCULATIONS;
  const hasTokens = user.tokens > 0;
  const isPremium = user.isPremium;
  
  return {
    allowed: hasFreeCals || hasTokens || isPremium,
    useFree: hasFreeCals,
    reason: !hasFreeCals && !hasTokens && !isPremium ? 'No free calculations or tokens remaining' : null
  };
}

// ==================== ROUTES ====================

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Get User Status
app.get('/api/user/status', async (req, res) => {
  try {
    const identifier = req.headers['x-user-id'] || req.ip;
    const user = await getOrCreateUser(identifier);
    
    const freeRemaining = Math.max(0, FREE_DAILY_CALCULATIONS - user.dailyCalculations);
    
    res.json({
      tokens: user.tokens,
      freeCalculationsRemaining: freeRemaining,
      totalCalculations: user.totalCalculations,
      isPremium: user.isPremium,
      dailyLimit: FREE_DAILY_CALCULATIONS
    });
  } catch (error) {
    console.error('Error fetching user status:', error);
    res.status(500).json({ error: 'Failed to fetch user status' });
  }
});

// Perform Calculation (with token/free check)
app.post('/api/calculate', async (req, res) => {
  try {
    const identifier = req.headers['x-user-id'] || req.ip;
    const { prompt, systemInstruction, calculationType } = req.body;
    
    if (!prompt || !systemInstruction || !calculationType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const user = await getOrCreateUser(identifier);
    const canCalc = canPerformCalculation(user);
    
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
      return res.status(500).json({ error: 'API key not configured' });
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
      const errorData = await response.json();
      console.error('Gemini API Error:', errorData);
      throw new Error(`Gemini API failed: ${response.status}`);
    }
    
    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    
    res.json({ 
      text: responseText,
      tokensUsed,
      isFree,
      remainingTokens: user.tokens,
      freeRemaining: Math.max(0, FREE_DAILY_CALCULATIONS - user.dailyCalculations)
    });
    
  } catch (error) {
    console.error('Calculation error:', error);
    res.status(500).json({ error: 'Calculation failed' });
  }
});

// Purchase Tokens
app.post('/api/tokens/purchase', async (req, res) => {
  try {
    const identifier = req.headers['x-user-id'] || req.ip;
    const { package: packageType, paymentIntentId } = req.body;
    
    const user = await getOrCreateUser(identifier);
    
    // Token packages
    const packages = {
      starter: { tokens: 50, price: 4.99 },
      premium: { tokens: 150, price: 12.99 },
      pro: { tokens: 500, price: 39.99 }
    };
    
    const selectedPackage = packages[packageType];
    if (!selectedPackage) {
      return res.status(400).json({ error: 'Invalid package' });
    }
    
    // In production, verify payment with Stripe here
    // For now, simulate successful payment
    
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
    
    res.json({
      success: true,
      newBalance: user.tokens,
      tokensAdded: selectedPackage.tokens
    });
    
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'Purchase failed' });
  }
});

// Watch Ad (get bonus tokens)
app.post('/api/tokens/watch-ad', async (req, res) => {
  try {
    const identifier = req.headers['x-user-id'] || req.ip;
    const { adId } = req.body;
    
    const user = await getOrCreateUser(identifier);
    
    // Limit ads per day
    const adsWatchedToday = await Calculation.countDocuments({
      userId: user._id,
      calculationType: 'ad',
      timestamp: { $gte: new Date().setHours(0, 0, 0, 0) }
    });
    
    if (adsWatchedToday >= 5) {
      return res.status(429).json({ error: 'Daily ad limit reached' });
    }
    
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
    
    res.json({
      success: true,
      tokensEarned: adReward,
      newBalance: user.tokens,
      adsRemaining: 5 - adsWatchedToday - 1
    });
    
  } catch (error) {
    console.error('Ad watch error:', error);
    res.status(500).json({ error: 'Failed to process ad' });
  }
});

// Get User History
app.get('/api/user/history', async (req, res) => {
  try {
    const identifier = req.headers['x-user-id'] || req.ip;
    const user = await getOrCreateUser(identifier);
    
    const calculations = await Calculation.find({ userId: user._id })
      .sort({ timestamp: -1 })
      .limit(50);
    
    res.json({ calculations });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Admin: Get Stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const totalUsers = await User.countDocuments();
    const totalCalculations = await Calculation.countDocuments();
    const totalRevenue = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    res.json({
      totalUsers,
      totalCalculations,
      totalRevenue: totalRevenue[0]?.total || 0,
      activeToday: await User.countDocuments({
        lastActive: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
