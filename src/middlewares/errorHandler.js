const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');
const config = require('../config/config');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error Handler:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Prisma errors
  if (err.code === 'P2002') {
    error = new AppError('Duplicate field value', 409);
  }

  if (err.code === 'P2025') {
    error = new AppError('Resource not found', 404);
  }

  if (err.code === 'P2003') {
    error = new AppError('Foreign key constraint failed', 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    error = new AppError(err.message, 400);
  }

  // Send response
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(config.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err,
    }),
  });
};

module.exports = errorHandler;
