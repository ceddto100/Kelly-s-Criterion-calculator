// config/database.js - Database configuration and models
const mongoose = require('mongoose');
const { logger } = require('../middleware/errorHandler');

// User Schema with validation and indexes
const userSchema = new mongoose.Schema({
  identifier: {
    type: String,
    required: [true, 'User identifier is required'],
    unique: true,
    trim: true,
    maxlength: [200, 'Identifier too long']
  },
  tokens: {
    type: Number,
    default: 0,
    min: [0, 'Tokens cannot be negative']
  },
  dailyCalculations: {
    type: Number,
    default: 0,
    min: [0, 'Daily calculations cannot be negative']
  },
  lastResetDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  totalCalculations: {
    type: Number,
    default: 0,
    min: [0, 'Total calculations cannot be negative']
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  lastActive: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Indexes for User
userSchema.index({ identifier: 1 }, { unique: true });
userSchema.index({ lastActive: -1 });
userSchema.index({ lastResetDate: -1 });
userSchema.index({ isPremium: 1, lastActive: -1 });

// User methods
userSchema.methods.canPerformCalculation = function() {
  const FREE_DAILY_CALCULATIONS = 10;
  const hasFreeCals = this.dailyCalculations < FREE_DAILY_CALCULATIONS;
  const hasTokens = this.tokens > 0;
  const isPremium = this.isPremium;

  return {
    allowed: hasFreeCals || hasTokens || isPremium,
    useFree: hasFreeCals,
    reason: !hasFreeCals && !hasTokens && !isPremium
      ? 'No free calculations or tokens remaining'
      : null
  };
};

userSchema.methods.resetDailyCalculationsIfNeeded = function() {
  const today = new Date().setHours(0, 0, 0, 0);
  const lastReset = new Date(this.lastResetDate).setHours(0, 0, 0, 0);

  if (today > lastReset) {
    this.dailyCalculations = 0;
    this.lastResetDate = new Date();
    return true;
  }
  return false;
};

// Calculation Log Schema with validation and indexes
const calculationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  calculationType: {
    type: String,
    enum: {
      values: ['kelly', 'probability', 'unit', 'ad'],
      message: '{VALUE} is not a valid calculation type'
    },
    required: [true, 'Calculation type is required']
  },
  tokensUsed: {
    type: Number,
    default: 0
  },
  isFree: {
    type: Boolean,
    default: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false,
  collection: 'calculations'
});

// Indexes for Calculation
calculationSchema.index({ userId: 1, timestamp: -1 });
calculationSchema.index({ calculationType: 1, timestamp: -1 });
calculationSchema.index({ timestamp: -1 });

// Transaction Schema with validation and indexes
const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount must be positive']
  },
  tokens: {
    type: Number,
    required: [true, 'Tokens count is required'],
    min: [1, 'Tokens must be positive']
  },
  paymentId: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'completed', 'failed'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  timestamps: true,
  collection: 'transactions'
});

// Indexes for Transaction
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ paymentId: 1 });

// Create models
const User = mongoose.model('User', userSchema);
const Calculation = mongoose.model('Calculation', calculationSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

// Database connection function
async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  try {
    // Connect with updated options
    await mongoose.connect(mongoUri, {
      // Modern options (useNewUrlParser and useUnifiedTopology are deprecated)
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
    });

    logger.info('MongoDB connected successfully', {
      database: mongoose.connection.name,
      host: mongoose.connection.host
    });

    // Create indexes
    await Promise.all([
      User.createIndexes(),
      Calculation.createIndexes(),
      Transaction.createIndexes()
    ]);

    logger.info('Database indexes created successfully');

    // Monitor connection events
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error', { error: error.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    return mongoose.connection;
  } catch (error) {
    logger.error('MongoDB connection failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Health check function
async function checkDatabaseHealth() {
  try {
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    if (state === 1) {
      // Ping the database
      await mongoose.connection.db.admin().ping();
      return {
        status: 'healthy',
        state: states[state],
        database: mongoose.connection.name
      };
    }

    return {
      status: 'unhealthy',
      state: states[state]
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

module.exports = {
  connectDatabase,
  checkDatabaseHealth,
  User,
  Calculation,
  Transaction,
  mongoose
};
