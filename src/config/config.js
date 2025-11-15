require('dotenv').config();

const config = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  FRONTEND_URL_PROD: process.env.FRONTEND_URL_PROD || '',

  // WebSocket
  WS_PING_TIMEOUT: 60000,
  WS_PING_INTERVAL: 25000,

  // Redis
  REDIS_URL: process.env.REDIS_URL,

  // Application Limits
  MAX_BOARD_SIZE_MB: parseInt(process.env.MAX_BOARD_SIZE_MB || '50', 10),
  MAX_CONCURRENT_USERS_PER_BOARD: parseInt(
    process.env.MAX_CONCURRENT_USERS_PER_BOARD || '50',
    10
  ),
  SAVE_DEBOUNCE_MS: parseInt(process.env.SAVE_DEBOUNCE_MS || '2000', 10),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Email
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
};

// Validation
if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

if (!config.DATABASE_URL) {
  throw new Error('DATABASE_URL is required in environment variables');
}

module.exports = config;
