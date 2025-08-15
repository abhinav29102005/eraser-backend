require('dotenv').config();

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-default-secret-key',
  WS_PORT: process.env.WS_PORT || 4000,
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // CORS settings for WebSocket
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3001',
  
  // Yjs specific settings
  YJS_GC_ENABLED: process.env.YJS_GC_ENABLED === 'true',
  YJS_PERSISTENCE_INTERVAL: parseInt(process.env.YJS_PERSISTENCE_INTERVAL) || 5000,
  
  // Connection limits
  MAX_CONNECTIONS_PER_BOARD: parseInt(process.env.MAX_CONNECTIONS_PER_BOARD) || 50,
  CONNECTION_TIMEOUT: parseInt(process.env.CONNECTION_TIMEOUT) || 30000,
};