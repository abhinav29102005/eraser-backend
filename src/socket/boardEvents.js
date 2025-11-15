const prisma = require('../services/prisma');
const roomManager = require('./roomManager');
const logger = require('../utils/logger');
const { SOCKET_EVENTS } = require('../utils/constants');

module.exports = (io, socket) => {
  // Join board event
  socket.on(SOCKET_EVENTS.JOIN_BOARD, async (data) => {
    try {
      const { boardId } = data;

      if (!socket.authenticated) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Authentication required' });
        return;
      }

      if (!boardId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Board ID required' });
        return;
      }

      // Verify access to board
      const board = await prisma.board.findFirst({
        where: {
          id: boardId,
          OR: [
            { userId: socket.userId },
            {
              collaborators: {
                some: { userId: socket.userId },
              },
            },
            { isPublic: true },
          ],
          isDeleted: false,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!board) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Board not found or access denied' });
        return;
      }

      // Leave previous board
      const prevBoardId = roomManager.getBoardForSocket(socket.id);
      if (prevBoardId) {
        socket.leave(prevBoardId);
        socket.to(prevBoardId).emit(SOCKET_EVENTS.USER_LEFT, {
          userId: socket.userId,
          userName: socket.userName,
          socketId: socket.id,
        });
      }

      // Join new board room
      socket.join(boardId);
      const activeUsers = roomManager.joinBoard(socket.id, boardId);

      // Notify others
      socket.to(boardId).emit(SOCKET_EVENTS.USER_JOINED, {
        userId: socket.userId,
        userName: socket.userName,
        socketId: socket.id,
        activeUsers: activeUsers.length,
      });

      // Send current board state to joining user
      socket.emit(SOCKET_EVENTS.BOARD_STATE, {
        documentState: board.documentState || [],
        activeUsers,
        boardInfo: {
          id: board.id,
          title: board.title,
          ownerId: board.userId,
          ownerName: board.user.name,
        },
      });

      // Update last seen
      await prisma.boardCollaborator.updateMany({
        where: {
          boardId,
          userId: socket.userId,
        },
        data: {
          lastSeenAt: new Date(),
        },
      });

      logger.info(`User ${socket.userEmail} joined board ${boardId}`);
    } catch (error) {
      logger.error('Error joining board:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to join board' });
    }
  });

  // Leave board event
  socket.on(SOCKET_EVENTS.LEAVE_BOARD, (data) => {
    const { boardId } = data;

    socket.leave(boardId);
    roomManager.leaveBoard(socket.id, boardId);

    socket.to(boardId).emit(SOCKET_EVENTS.USER_LEFT, {
      userId: socket.userId,
      userName: socket.userName,
      socketId: socket.id,
    });

    logger.info(`User ${socket.userEmail} left board ${boardId}`);
  });
};
