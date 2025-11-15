const roomManager = require('./roomManager');
const { SOCKET_EVENTS } = require('../utils/constants');

module.exports = (io, socket) => {
  // Cursor move event
  socket.on(SOCKET_EVENTS.CURSOR_MOVE, (data) => {
    const { boardId, x, y } = data;

    const currentBoardId = roomManager.getBoardForSocket(socket.id);
    if (currentBoardId !== boardId) return;

    // Broadcast cursor position to others (not to sender)
    socket.to(boardId).emit(SOCKET_EVENTS.CURSOR_MOVE, {
      userId: socket.userId,
      userName: socket.userName,
      x,
      y,
      socketId: socket.id,
    });
  });

  // Cursor action event (drawing start/end, selection, etc.)
  socket.on(SOCKET_EVENTS.CURSOR_ACTION, (data) => {
    const { boardId, action, toolType } = data;

    const currentBoardId = roomManager.getBoardForSocket(socket.id);
    if (currentBoardId !== boardId) return;

    socket.to(boardId).emit(SOCKET_EVENTS.CURSOR_ACTION, {
      userId: socket.userId,
      userName: socket.userName,
      action, // 'draw_start', 'draw_end', 'select', etc.
      toolType,
    });
  });
};
