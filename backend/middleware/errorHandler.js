// middleware/errorHandler.js - Centralized error handling
const { sanitizeError } = require('./validation');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 403);
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 500);
  }
}

// Logger utility (simple console logger, can be replaced with Winston/Pino)
const logger = {
  error: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR:`, message, meta);
  },
  warn: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] WARN:`, message, meta);
  },
  info: (message, meta = {}) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] INFO:`, message, meta);
  }
};

// Main error handler middleware
function errorHandler(err, req, res, next) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errors = err.errors || null;

  // Handle specific error types
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    errors = err.errors;
  } else if (err.name === 'MongoServerError') {
    statusCode = 500;
    message = 'Database error occurred';
    // Handle duplicate key error
    if (err.code === 11000) {
      statusCode = 409;
      message = 'Duplicate entry exists';
    }
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
  }

  // Log the error
  if (statusCode >= 500) {
    logger.error(message, {
      error: err.name,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
  } else {
    logger.warn(message, {
      error: err.name,
      path: req.path,
      method: req.method
    });
  }

  // Send error response
  const response = {
    error: message,
    ...(errors && { details: errors }),
    ...(isDevelopment && statusCode >= 500 && { stack: err.stack })
  };

  res.status(statusCode).json(response);
}

// 404 handler for undefined routes
function notFoundHandler(req, res, next) {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
}

// Async error wrapper - wraps async route handlers
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Graceful shutdown handler
function setupGracefulShutdown(server, mongoose) {
  const shutdown = async (signal) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close database connection
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');

        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
      }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  // Listen for termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack
    });
    shutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
      reason: reason,
      promise: promise
    });
    shutdown('unhandledRejection');
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  setupGracefulShutdown,
  logger,
  // Error classes
  AppError,
  NotFoundError,
  UnauthorizedError,
  RateLimitError,
  DatabaseError
};
