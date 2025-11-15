const prisma = require('../services/prisma');
const roomManager = require('./roomManager');
const logger = require('../utils/logger');
const { SOCKET_EVENTS } = require('../utils/constants');
const config = require('../config/config');

// Debounce mechanism for database writes
const pendingUpdates = new Map(); // boardId -> { timeout, elements[] }

module.exports = (io, socket) => {
  // Drawing update event
  socket.on(SOCKET_EVENTS.DRAWING_UPDATE, async (data) => {
    try {
      const { boardId, element } = data;

      const currentBoardId = roomManager.getBoardForSocket(socket.id);
      if (currentBoardId !== boardId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Not in this board' });
        return;
      }

      // Update activity
      roomManager.updateActivity(socket.id);

      // Enrich element with metadata
      const enrichedElement = {
        ...element,
        id: element.id || `${socket.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: socket.userId,
        userName: socket.userName,
        timestamp: new Date().toISOString(),
      };

      // Broadcast to others immediately (not to sender)
      socket.to(boardId).emit(SOCKET_EVENTS.DRAWING_UPDATE, {
        element: enrichedElement,
        fromUser: {
          id: socket.userId,
          name: socket.userName,
        },
      });

      // Debounced save to database
      saveBoardStateDebounced(boardId, enrichedElement);
    } catch (error) {
      logger.error('Error handling drawing update:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to update drawing' });
    }
  });

  // Element delete event
  socket.on(SOCKET_EVENTS.ELEMENT_DELETE, async (data) => {
    try {
      const { boardId, elementId } = data;

      const currentBoardId = roomManager.getBoardForSocket(socket.id);
      if (currentBoardId !== boardId) return;

      // Broadcast deletion
      socket.to(boardId).emit(SOCKET_EVENTS.ELEMENT_DELETE, {
        elementId,
        fromUser: { id: socket.userId, name: socket.userName },
      });

      // Update database
      await removeElementFromBoard(boardId, elementId);
    } catch (error) {
      logger.error('Error deleting element:', error);
    }
  });

  // Board clear event
  socket.on(SOCKET_EVENTS.BOARD_CLEAR, async (data) => {
    try {
      const { boardId } = data;

      const currentBoardId = roomManager.getBoardForSocket(socket.id);
      if (currentBoardId !== boardId) return;

      // Clear in database
      await prisma.board.update({
        where: { id: boardId },
        data: {
          documentState: [],
          lastEditedAt: new Date(),
        },
      });

      // Broadcast to all users (including sender)
      io.to(boardId).emit(SOCKET_EVENTS.BOARD_CLEAR, {
        fromUser: { id: socket.userId, name: socket.userName },
      });

      logger.info(`Board ${boardId} cleared by ${socket.userName}`);
    } catch (error) {
      logger.error('Error clearing board:', error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Failed to clear board' });
    }
  });

  // Undo action
  socket.on(SOCKET_EVENTS.UNDO_ACTION, (data) => {
    const { boardId, elementId } = data;
    socket.to(boardId).emit(SOCKET_EVENTS.UNDO_ACTION, { elementId });
  });

  // Redo action
  socket.on(SOCKET_EVENTS.REDO_ACTION, (data) => {
    const { boardId, elementId } = data;
    socket.to(boardId).emit(SOCKET_EVENTS.REDO_ACTION, { elementId });
  });
};

// Helper: Debounced save to database
function saveBoardStateDebounced(boardId, element) {
  // Get or create pending update entry
  if (!pendingUpdates.has(boardId)) {
    pendingUpdates.set(boardId, { timeout: null, elements: [] });
  }

  const pending = pendingUpdates.get(boardId);

  // Add element to queue
  pending.elements.push(element);

  // Clear existing timeout
  if (pending.timeout) {
    clearTimeout(pending.timeout);
  }

  // Set new timeout
  pending.timeout = setTimeout(async () => {
    try {
      const elementsToSave = [...pending.elements];
      pending.elements = [];

      // Fetch current state
      const board = await prisma.board.findUnique({
        where: { id: boardId },
        select: { documentState: true },
      });

      const currentState = board?.documentState || [];
      const updatedState = [...currentState, ...elementsToSave];

      // Save to database
      await prisma.board.update({
        where: { id: boardId },
        data: {
          documentState: updatedState,
          lastEditedAt: new Date(),
        },
      });

      logger.debug(`Board ${boardId} saved with ${elementsToSave.length} new elements`);
    } catch (error) {
      logger.error(`Failed to save board ${boardId}:`, error);
    } finally {
      pendingUpdates.delete(boardId);
    }
  }, config.SAVE_DEBOUNCE_MS);
}

// Helper: Remove element from board
async function removeElementFromBoard(boardId, elementId) {
  try {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { documentState: true },
    });

    const filteredState = (board?.documentState || []).filter((el) => el.id !== elementId);

    await prisma.board.update({
      where: { id: boardId },
      data: {
        documentState: filteredState,
        lastEditedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error removing element:', error);
  }
}
