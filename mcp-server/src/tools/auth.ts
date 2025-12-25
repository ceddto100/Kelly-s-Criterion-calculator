/**
 * User Authentication Tools
 * Handles user authentication status and session management
 */

import { z } from 'zod';
import { User, IUser } from '../models/User.js';
import { isDatabaseConnected } from '../config/database.js';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const checkAuthInputSchema = z.object({
  userId: z
    .string()
    .min(1)
    .describe('User identifier (Google ID) to check authentication status')
});

export const getUserProfileInputSchema = z.object({
  userId: z
    .string()
    .min(1)
    .describe('User identifier to retrieve profile for')
});

export const registerUserInputSchema = z.object({
  googleId: z
    .string()
    .min(1)
    .describe('Google OAuth ID'),

  email: z
    .string()
    .email()
    .optional()
    .describe('User email address'),

  displayName: z
    .string()
    .optional()
    .describe('User display name'),

  profilePhoto: z
    .string()
    .url()
    .optional()
    .describe('URL to profile photo')
});

export type CheckAuthInput = z.infer<typeof checkAuthInputSchema>;
export type GetUserProfileInput = z.infer<typeof getUserProfileInputSchema>;
export type RegisterUserInput = z.infer<typeof registerUserInputSchema>;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const checkAuthToolDefinition = {
  name: 'check_auth_status',
  description: `Check if a user is authenticated and get their authentication status.

Returns user's authentication state, premium status, remaining free calculations, and account info.

Note: This MCP server doesn't handle OAuth flow directly. Use this to verify a user exists and check their status after they've authenticated through the web frontend.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string',
        description: 'User identifier (Google ID) to check',
        minLength: 1
      }
    },
    required: ['userId']
  }
};

export const getUserProfileToolDefinition = {
  name: 'get_user_profile',
  description: `Get detailed profile information for an authenticated user.

Returns:
- Account details (email, display name)
- Current bankroll
- Calculation statistics
- Premium status
- Account creation date`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string',
        description: 'User identifier to retrieve profile for',
        minLength: 1
      }
    },
    required: ['userId']
  }
};

export const registerUserToolDefinition = {
  name: 'register_user',
  description: `Register a new user or update existing user from Google OAuth data.

Creates a new user account if one doesn't exist, or updates existing account info.
Returns the user profile with authentication status.

Note: Typically called after successful Google OAuth authentication on the frontend.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      googleId: {
        type: 'string',
        description: 'Google OAuth ID',
        minLength: 1
      },
      email: {
        type: 'string',
        format: 'email',
        description: 'User email address'
      },
      displayName: {
        type: 'string',
        description: 'User display name'
      },
      profilePhoto: {
        type: 'string',
        format: 'uri',
        description: 'URL to profile photo'
      }
    },
    required: ['googleId']
  }
};

// ============================================================================
// HANDLERS
// ============================================================================

export async function handleCheckAuth(input: unknown): Promise<AuthStatusOutput> {
  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected.');
  }

  const parsed = checkAuthInputSchema.parse(input);

  const user = await User.findOne({ identifier: parsed.userId });

  if (!user) {
    return {
      success: true,
      isAuthenticated: false,
      message: 'User not found. Please authenticate through the web frontend first.'
    };
  }

  const calcPermission = user.canPerformCalculation();

  return {
    success: true,
    isAuthenticated: true,
    user: {
      id: user.identifier,
      email: user.email,
      displayName: user.displayName,
      isPremium: user.isPremium,
      currentBankroll: user.currentBankroll
    },
    calculations: {
      canPerform: calcPermission.allowed,
      dailyUsed: user.dailyCalculations,
      dailyLimit: 10,
      totalPerformed: user.totalCalculations,
      tokensRemaining: user.tokens
    }
  };
}

export async function handleGetUserProfile(input: unknown): Promise<UserProfileOutput> {
  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected.');
  }

  const parsed = getUserProfileInputSchema.parse(input);

  const user = await User.findOne({ identifier: parsed.userId });

  if (!user) {
    throw new Error(`User not found with ID: ${parsed.userId}`);
  }

  return {
    success: true,
    profile: {
      id: user.identifier,
      email: user.email,
      displayName: user.displayName,
      profilePhoto: user.profilePhoto,
      isPremium: user.isPremium,
      currentBankroll: user.currentBankroll,
      tokens: user.tokens,
      statistics: {
        totalCalculations: user.totalCalculations,
        dailyCalculations: user.dailyCalculations,
        lastResetDate: user.lastResetDate.toISOString()
      },
      createdAt: user.createdAt.toISOString(),
      lastActive: user.lastActive.toISOString()
    }
  };
}

export async function handleRegisterUser(input: unknown): Promise<RegisterUserOutput> {
  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected.');
  }

  const parsed = registerUserInputSchema.parse(input);

  const user = await User.findOrCreateByGoogleId(
    parsed.googleId,
    parsed.email,
    parsed.displayName,
    parsed.profilePhoto
  );

  const isNewUser = user.totalCalculations === 0;

  return {
    success: true,
    isNewUser,
    message: isNewUser ? 'New user registered successfully' : 'User profile updated',
    user: {
      id: user.identifier,
      email: user.email,
      displayName: user.displayName,
      isPremium: user.isPremium,
      currentBankroll: user.currentBankroll
    }
  };
}

export interface AuthStatusOutput {
  success: boolean;
  isAuthenticated: boolean;
  message?: string;
  user?: {
    id: string;
    email?: string;
    displayName?: string;
    isPremium: boolean;
    currentBankroll: number;
  };
  calculations?: {
    canPerform: boolean;
    dailyUsed: number;
    dailyLimit: number;
    totalPerformed: number;
    tokensRemaining: number;
  };
}

export interface UserProfileOutput {
  success: boolean;
  profile: {
    id: string;
    email?: string;
    displayName?: string;
    profilePhoto?: string;
    isPremium: boolean;
    currentBankroll: number;
    tokens: number;
    statistics: {
      totalCalculations: number;
      dailyCalculations: number;
      lastResetDate: string;
    };
    createdAt: string;
    lastActive: string;
  };
}

export interface RegisterUserOutput {
  success: boolean;
  isNewUser: boolean;
  message: string;
  user: {
    id: string;
    email?: string;
    displayName?: string;
    isPremium: boolean;
    currentBankroll: number;
  };
}
