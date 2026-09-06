/**
 * User model for authentication and bankroll management
 * Mirrors the backend User model structure
 */

import mongoose, { Document, Model, Schema } from 'mongoose';

// ============================================================================
// INTERFACES
// ============================================================================

export interface IUser extends Document {
  identifier: string;           // Google ID
  email?: string;
  displayName?: string;
  profilePhoto?: string;
  tokens: number;
  dailyCalculations: number;
  lastResetDate: Date;
  totalCalculations: number;
  isPremium: boolean;
  currentBankroll: number;
  createdAt: Date;
  lastActive: Date;
  canPerformCalculation(): CalculationPermission;
  incrementCalculation(): Promise<void>;
  updateBankroll(amount: number): Promise<void>;
}

export interface IUserModel extends Model<IUser> {
  findOrCreateByGoogleId(
    googleId: string,
    email?: string,
    displayName?: string,
    profilePhoto?: string
  ): Promise<IUser>;
}

export interface CalculationPermission {
  allowed: boolean;
  useFree: boolean;
  reason?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FREE_DAILY_CALCULATIONS = 10;
const DEFAULT_BANKROLL = 1000;

// ============================================================================
// SCHEMA
// ============================================================================

const userSchema = new Schema<IUser>(
  {
    identifier: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    email: {
      type: String,
      unique: true,
      sparse: true
    },
    displayName: {
      type: String
    },
    profilePhoto: {
      type: String
    },
    tokens: {
      type: Number,
      default: 0
    },
    dailyCalculations: {
      type: Number,
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    },
    totalCalculations: {
      type: Number,
      default: 0
    },
    isPremium: {
      type: Boolean,
      default: false
    },
    currentBankroll: {
      type: Number,
      default: DEFAULT_BANKROLL
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    },
    lastActive: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false // We manage our own timestamps
  }
);

// ============================================================================
// INSTANCE METHODS
// ============================================================================

userSchema.methods.canPerformCalculation = function (): CalculationPermission {
  // Check if daily limit needs reset
  const now = new Date();
  const lastReset = new Date(this.lastResetDate);
  const isNewDay =
    now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCDate() !== lastReset.getUTCDate();

  // If it's a new day, calculations will be reset
  const effectiveDailyCalcs = isNewDay ? 0 : this.dailyCalculations;

  // Premium users have unlimited
  if (this.isPremium) {
    return { allowed: true, useFree: false };
  }

  // Check free calculations
  if (effectiveDailyCalcs < FREE_DAILY_CALCULATIONS) {
    return { allowed: true, useFree: true };
  }

  // Check tokens
  if (this.tokens > 0) {
    return { allowed: true, useFree: false };
  }

  return {
    allowed: false,
    useFree: false,
    reason: `Daily limit of ${FREE_DAILY_CALCULATIONS} free calculations reached. Purchase tokens or upgrade to premium.`
  };
};

userSchema.methods.incrementCalculation = async function (): Promise<void> {
  const now = new Date();
  const lastReset = new Date(this.lastResetDate);
  const isNewDay =
    now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCDate() !== lastReset.getUTCDate();

  if (isNewDay) {
    this.dailyCalculations = 1;
    this.lastResetDate = now;
  } else {
    this.dailyCalculations += 1;
  }

  this.totalCalculations += 1;
  this.lastActive = now;

  // Deduct token if not using free calculation
  if (!this.isPremium && this.dailyCalculations > FREE_DAILY_CALCULATIONS && this.tokens > 0) {
    this.tokens -= 1;
  }

  await this.save();
};

userSchema.methods.updateBankroll = async function (amount: number): Promise<void> {
  this.currentBankroll = Math.max(0, amount);
  this.lastActive = new Date();
  await this.save();
};

// ============================================================================
// STATIC METHODS
// ============================================================================

userSchema.statics.findOrCreateByGoogleId = async function (
  googleId: string,
  email?: string,
  displayName?: string,
  profilePhoto?: string
): Promise<IUser> {
  let user = await this.findOne({ identifier: googleId });

  if (!user) {
    user = new this({
      identifier: googleId,
      email,
      displayName,
      profilePhoto,
      createdAt: new Date(),
      lastActive: new Date()
    });
    await user.save();
  } else {
    // Update user info if changed
    let needsSave = false;

    if (email && user.email !== email) {
      user.email = email;
      needsSave = true;
    }
    if (displayName && user.displayName !== displayName) {
      user.displayName = displayName;
      needsSave = true;
    }
    if (profilePhoto && user.profilePhoto !== profilePhoto) {
      user.profilePhoto = profilePhoto;
      needsSave = true;
    }

    user.lastActive = new Date();

    if (needsSave) {
      await user.save();
    }
  }

  return user;
};

// ============================================================================
// MODEL
// ============================================================================

export const User = mongoose.model<IUser, IUserModel>('User', userSchema);
