const { verifyToken } = require('../services/jwt');
const prisma = require('../services/prisma');
const roomManager = require('./roomManager');
const boardEvents = require('./boardEvents');
const drawingEvents = require('./drawingEvents');
const cursorEvents = require('./cursorEvents');
const logger = require('../utils/logger');
const { SOCKET_EVENTS } = require('../utils/constants');

const socketHandler = (io, socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  // Authentication event
  socket.on(SOCKET_EVENTS.AUTHENTICATE, async (data) => {
    try {
      const { token } = data;

      if (!token) {
        socket.emit(SOCKET_EVENTS.AUTH_ERROR, { message: 'Token required' });
        return;
      }

      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true },
      });

      if (!user) {
        socket.emit(SOCKET_EVENTS.AUTH_ERROR, { message: 'User not found' });
        return;
      }

      // Store user info on socket
      socket.authenticated = true;
      socket.userId = user.id;
      socket.userEmail = user.email;
      socket.userName = user.name || 'Anonymous';

      // Track in room manager
      roomManager.addSocket(socket.id, {
        userId: user.id,
        userName: socket.userName,
        userEmail: user.email,
        socketId: socket.id,
        boardId: null,
      });

      socket.emit(SOCKET_EVENTS.AUTHENTICATED, {
        user: { id: user.id, email: user.email, name: user.name },
      });

      logger.info(`User authenticated: ${user.email} (${socket.id})`);
    } catch (error) {
      logger.error('Authentication error:', error);
      socket.emit(SOCKET_EVENTS.AUTH_ERROR, { message: 'Authentication failed' });
    }
  });

  // Register event handlers from modules
  boardEvents(io, socket);
  drawingEvents(io, socket);
  cursorEvents(io, socket);

  // Disconnection event
  socket.on('disconnect', () => {
    const socketData = roomManager.removeSocket(socket.id);

    if (socketData && socketData.boardId) {
      socket.to(socketData.boardId).emit(SOCKET_EVENTS.USER_LEFT, {
        userId: socketData.userId,
        userName: socketData.userName,
        socketId: socket.id,
      });
    }

    logger.info(`Socket disconnected: ${socket.id}`);
  });

  // Error event
  socket.on('error', (error) => {
    logger.error(`Socket error for ${socket.id}:`, error);
  });
};

module.exports = socketHandler;
