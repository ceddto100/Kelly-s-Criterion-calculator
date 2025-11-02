// middleware/validation.js - Input validation middleware
const { z } = require('zod');

// Custom validation error class
class ValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
    this.statusCode = 400;
  }
}

// Validation schemas
const schemas = {
  calculate: z.object({
    prompt: z.string().min(1).max(5000),
    systemInstruction: z.string().min(1).max(5000),
    calculationType: z.enum(['kelly', 'probability', 'unit'])
  }),

  tokenPurchase: z.object({
    package: z.enum(['starter', 'premium', 'pro']),
    paymentIntentId: z.string().optional()
  }),

  watchAd: z.object({
    adId: z.string().min(1).max(100)
  }),

  matchup: z.object({
    sport: z.string().min(1).max(50),
    team1: z.string().min(1).max(100),
    team2: z.string().min(1).max(100),
    season: z.string().optional(),
    provider: z.enum(['openai', 'claude']).optional().default('openai')
  }),

  userIdentifier: z.string().min(1).max(200)
};

// Middleware factory function
function validateRequest(schemaName) {
  return (req, res, next) => {
    try {
      const schema = schemas[schemaName];
      if (!schema) {
        throw new Error(`Validation schema '${schemaName}' not found`);
      }

      const validated = schema.parse(req.body);
      req.validatedData = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = new ValidationError(
          'Validation failed',
          error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        );
        next(validationError);
      } else {
        next(error);
      }
    }
  };
}

// Validate user identifier from header or IP
function validateUserIdentifier(req, res, next) {
  try {
    const identifier = req.headers['x-user-id'] || req.ip;

    if (!identifier || identifier.length === 0) {
      throw new ValidationError('User identifier is required', [
        { field: 'x-user-id', message: 'Header or IP address required' }
      ]);
    }

    // Basic sanitization
    const sanitized = String(identifier).trim().substring(0, 200);
    req.userIdentifier = sanitized;
    next();
  } catch (error) {
    next(error);
  }
}

// Sanitize output to prevent sensitive data leaks
function sanitizeError(error) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    error: error.message || 'An error occurred',
    ...(isDevelopment && { stack: error.stack }),
    ...(error.errors && { details: error.errors })
  };
}

module.exports = {
  validateRequest,
  validateUserIdentifier,
  ValidationError,
  sanitizeError,
  schemas
};
