const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const config = require('../config/config');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

const transports = [
  // Console
  new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), logFormat),
  }),

  // Error Log - Daily Rotate
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat,
  }),

  // Combined Log - Daily Rotate
  new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat,
  }),
];

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  transports,
  exceptionHandlers: [new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') })],
  rejectionHandlers: [new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') })],
});

module.exports = logger;