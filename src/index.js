require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const config = require('./config/config');
const logger = require('./utils/logger');
const prisma = require('./services/prisma');
const errorHandler = require('./middlewares/errorHandler');
const rateLimit = require('express-rate-limit');

// Initialize Express
const app = express();
const server = createServer(app);

// Socket.io Configuration
const io = new Server(server, {
  cors: {
    origin: [config.FRONTEND_URL, config.FRONTEND_URL_PROD].filter(Boolean),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB
  allowEIO3: true,
});

// Make io accessible in routes
app.set('io', io);

// Trust proxy (for deployment behind reverse proxy)
app.set('trust proxy', 1);

// Security Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  })
);

// Compression
app.use(compression());

// CORS Middleware
app.use(
  cors({
    origin: [config.FRONTEND_URL, config.FRONTEND_URL_PROD].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Request Logging
if (config.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    next();
  });
}

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    database: 'connected',
  });
});

// API Routes
const authRoutes = require('./routes/auth.routes');
const boardRoutes = require('./routes/board.routes');
const collaborationRoutes = require('./routes/collaboration.routes');

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/collaboration', collaborationRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global Error Handler
app.use(errorHandler);

// Socket.io Handler
const socketHandler = require('./socket/socketHandler');
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  socketHandler(io, socket);
});

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, closing server gracefully...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await prisma.$disconnect();
      logger.info('Database connection closed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled Rejection Handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught Exception Handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Start Server
const PORT = config.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT} in ${config.NODE_ENV} mode`);
  logger.info(`📡 Frontend URL: ${config.FRONTEND_URL}`);
  logger.info(`🗄️  Database: Connected`);
  logger.info(`⚡ Socket.io: Ready`);
});

module.exports = { app, server, io };
