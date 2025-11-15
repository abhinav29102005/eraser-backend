const logger = require('../utils/logger');

class RoomManager {
  constructor() {
    this.activeSockets = new Map(); // socketId -> userData
    this.boardRooms = new Map(); // boardId -> Set of socketIds
    this.userBoards = new Map(); // userId -> Set of boardIds
  }

  addSocket(socketId, userData) {
    this.activeSockets.set(socketId, {
      ...userData,
      joinedAt: new Date(),
      lastActivity: new Date(),
    });
    logger.debug(`Socket added: ${socketId}`);
  }

  removeSocket(socketId) {
    const socketData = this.activeSockets.get(socketId);

    if (socketData && socketData.boardId) {
      this.leaveBoard(socketId, socketData.boardId);
    }

    this.activeSockets.delete(socketId);
    logger.debug(`Socket removed: ${socketId}`);
    return socketData;
  }

  joinBoard(socketId, boardId) {
    const socketData = this.activeSockets.get(socketId);
    if (!socketData) return null;

    // Leave previous board
    if (socketData.boardId) {
      this.leaveBoard(socketId, socketData.boardId);
    }

    // Join new board
    if (!this.boardRooms.has(boardId)) {
      this.boardRooms.set(boardId, new Set());
    }

    this.boardRooms.get(boardId).add(socketId);

    // Track user -> boards
    if (!this.userBoards.has(socketData.userId)) {
      this.userBoards.set(socketData.userId, new Set());
    }
    this.userBoards.get(socketData.userId).add(boardId);

    socketData.boardId = boardId;
    this.activeSockets.set(socketId, socketData);

    logger.info(`Socket ${socketId} joined board ${boardId}`);
    return this.getActiveUsersInBoard(boardId);
  }

  leaveBoard(socketId, boardId) {
    const room = this.boardRooms.get(boardId);
    if (room) {
      room.delete(socketId);
      if (room.size === 0) {
        this.boardRooms.delete(boardId);
      }
    }

    const socketData = this.activeSockets.get(socketId);
    if (socketData) {
      socketData.boardId = null;

      const userBoards = this.userBoards.get(socketData.userId);
      if (userBoards) {
        userBoards.delete(boardId);
      }
    }

    logger.info(`Socket ${socketId} left board ${boardId}`);
  }

  getActiveUsersInBoard(boardId) {
    const room = this.boardRooms.get(boardId);
    if (!room) return [];

    return Array.from(room)
      .map((sid) => this.activeSockets.get(sid))
      .filter(Boolean)
      .map((user) => ({
        userId: user.userId,
        userName: user.userName,
        socketId: user.socketId,
      }));
  }

  getBoardForSocket(socketId) {
    const socketData = this.activeSockets.get(socketId);
    return socketData ? socketData.boardId : null;
  }

  getSocketData(socketId) {
    return this.activeSockets.get(socketId);
  }

  updateActivity(socketId) {
    const socketData = this.activeSockets.get(socketId);
    if (socketData) {
      socketData.lastActivity = new Date();
      this.activeSockets.set(socketId, socketData);
    }
  }

  getStats() {
    return {
      totalSockets: this.activeSockets.size,
      totalBoards: this.boardRooms.size,
      totalUsers: this.userBoards.size,
      boardStats: Array.from(this.boardRooms.entries()).map(([boardId, sockets]) => ({
        boardId,
        userCount: sockets.size,
      })),
    };
  }
}

module.exports = new RoomManager();
