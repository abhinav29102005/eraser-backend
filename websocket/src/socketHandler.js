// websocket/src/sockethandler.js
const prisma = require('../../src/services/prisma');
const { verifyToken } = require('../../src/services/jwt');

// Store active connections per board
const boardConnections = new Map(); // boardId -> Set of socket objects
const userBoards = new Map(); // socketId -> boardId

const socketHandler = (io, socket) => {
  console.log(`User connected: ${socket.id}`);
  

//   // Handle authentication
//   socket.on('authenticate', async (data) => {
//     try {
//       const { token } = data;
//       if (!token) {
//         socket.emit('auth_error', { message: 'Token required' });
//         return;
//       }

//       const decoded = verifyToken(token);
//       const user = await prisma.user.findUnique({
//         where: { id: decoded.userId }
//       });

//       if (!user) {
//         socket.emit('auth_error', { message: 'Invalid token' });
//         return;
//       }

//       socket.authenticated = true;
//       socket.userId = user.id;
//       socket.userEmail = user.email;
//       socket.userName = user.name;

//       socket.emit('authenticated', {
//         user: {
//           id: user.id,
//           email: user.email,
//           name: user.name
//         }
//       });

//       console.log(`User authenticated: ${user.email} (${socket.id})`);
//     } catch (error) {
//       console.error('Authentication error:', error);
//       socket.emit('auth_error', { message: 'Authentication failed' });
//     }
//   });

  // Join a board room for real-time collaboration
  socket.on('join_board', async (data) => {
    try {
      const { boardId } = data;
      
      if (!boardId) {
        socket.emit('error', { message: 'Board ID required' });
        return;
      }

      // Verify user has access to this board
      const board = await prisma.board.findUnique({
        where: {
          id: boardId,
          userId: socket.userId,
          isDeleted: false
        }
      });

      if (!board) {
        socket.emit('error', { message: 'Board not found or access denied' });
        return;
      }

      // Leave previous board if any
      const previousBoard = userBoards.get(socket.id);
      if (previousBoard) {
        socket.leave(previousBoard);
        const prevConnections = boardConnections.get(previousBoard);
        if (prevConnections) {
          prevConnections.delete(socket);
          if (prevConnections.size === 0) {
            boardConnections.delete(previousBoard);
          }
        }
      }

      // Join new board
      socket.join(boardId);
      userBoards.set(socket.id, boardId);

      // Track connection
      if (!boardConnections.has(boardId)) {
        boardConnections.set(boardId, new Set());
      }
      boardConnections.get(boardId).add(socket);

      // Notify others in the board
      socket.to(boardId).emit('user_joined', {
        userId: socket.userId,
        userName: socket.userName,
        socketId: socket.id
      });

      // Send current active users to the joining user
      const activeUsers = Array.from(boardConnections.get(boardId))
        .filter(s => s.id !== socket.id)
        .map(s => ({
          userId: s.userId,
          userName: s.userName,
          socketId: s.id
        }));

      socket.emit('board_joined', {
        boardId,
        activeUsers,
        userCount: boardConnections.get(boardId).size
      });

      console.log(`User ${socket.userEmail} joined board ${boardId}`);
    } catch (error) {
      console.error('Error joining board:', error);
      socket.emit('error', { message: 'Failed to join board' });
    }
  });

  // Handle new stroke creation
  socket.on('stroke_start', async (data) => {
    try {
      const { boardId, stroke } = data;
      const currentBoard = userBoards.get(socket.id);
      
      if (currentBoard !== boardId) {
        socket.emit('error', { message: 'Not joined to this board' });
        return;
      }

      // Broadcast to other users in the board
      socket.to(boardId).emit('stroke_start', {
        stroke,
        userId: socket.userId,
        userName: socket.userName
      });
    } catch (error) {
      console.error('Error handling stroke start:', error);
    }
  });

  // Handle stroke updates (while drawing)
  socket.on('stroke_update', async (data) => {
    try {
      const { boardId, stroke } = data;
      const currentBoard = userBoards.get(socket.id);
      
      if (currentBoard !== boardId) {
        socket.emit('error', { message: 'Not joined to this board' });
        return;
      }

      // Broadcast to other users in the board
      socket.to(boardId).emit('stroke_update', {
        stroke,
        userId: socket.userId,
        userName: socket.userName
      });
    } catch (error) {
      console.error('Error handling stroke update:', error);
    }
  });

  // Handle stroke completion and save to database
  socket.on('stroke_end', async (data) => {
    try {
      const { boardId, stroke } = data;
      const currentBoard = userBoards.get(socket.id);
      
      if (currentBoard !== boardId) {
        socket.emit('error', { message: 'Not joined to this board' });
        return;
      }

      // Save stroke to database
      const savedStroke = await prisma.stroke.create({
        data: {
          tool: stroke.tool || 'pen',
          color: stroke.color || 'black',
          strokeWidth: stroke.strokeWidth || 2,
          points: JSON.stringify(stroke.points),
          boardId: boardId
        }
      });

      // Broadcast to all users in the board (including sender)
      io.to(boardId).emit('stroke_saved', {
        stroke: {
          ...savedStroke,
          points: JSON.parse(savedStroke.points)
        },
        userId: socket.userId,
        userName: socket.userName
      });
    } catch (error) {
      console.error('Error saving stroke:', error);
      socket.emit('error', { message: 'Failed to save stroke' });
    }
  });

  // Handle stroke deletion
  socket.on('stroke_delete', async (data) => {
    try {
      const { boardId, strokeId } = data;
      const currentBoard = userBoards.get(socket.id);
      
      if (currentBoard !== boardId) {
        socket.emit('error', { message: 'Not joined to this board' });
        return;
      }

      // Delete from database
      await prisma.stroke.delete({
        where: {
          id: strokeId,
          board: {
            userId: socket.userId,
            isDeleted: false
          }
        }
      });

      // Broadcast to all users in the board
      io.to(boardId).emit('stroke_deleted', {
        strokeId,
        userId: socket.userId,
        userName: socket.userName
      });
    } catch (error) {
      console.error('Error deleting stroke:', error);
      socket.emit('error', { message: 'Failed to delete stroke' });
    }
  });

  // Handle board clear
  socket.on('board_clear', async (data) => {
    try {
      const { boardId } = data;
      const currentBoard = userBoards.get(socket.id);
      
      if (currentBoard !== boardId) {
        socket.emit('error', { message: 'Not joined to this board' });
        return;
      }

      // Clear all strokes from database
      await prisma.stroke.deleteMany({
        where: {
          boardId: boardId,
          board: {
            userId: socket.userId,
            isDeleted: false
          }
        }
      });

      // Broadcast to all users in the board
      io.to(boardId).emit('board_cleared', {
        userId: socket.userId,
        userName: socket.userName
      });
    } catch (error) {
      console.error('Error clearing board:', error);
      socket.emit('error', { message: 'Failed to clear board' });
    }
  });

  // Handle cursor movement for showing other users' cursors
  socket.on('cursor_move', (data) => {
    try {
      const { boardId, x, y } = data;
      const currentBoard = userBoards.get(socket.id);
      
      if (currentBoard !== boardId) {
        return;
      }

      // Broadcast cursor position to other users
      socket.to(boardId).emit('cursor_moved', {
        userId: socket.userId,
        userName: socket.userName,
        x,
        y
      });
    } catch (error) {
      console.error('Error handling cursor move:', error);
    }
  });


  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    const boardId = userBoards.get(socket.id);
    if (boardId) {
      // Remove from board connections
      const connections = boardConnections.get(boardId);
      if (connections) {
        connections.delete(socket);
        if (connections.size === 0) {
          boardConnections.delete(boardId);
        }
      }

      // Notify other users in the board
      socket.to(boardId).emit('user_left', {
        userId: socket.userId,
        userName: socket.userName,
        socketId: socket.id
      });
    }

    userBoards.delete(socket.id);
  });

  // Handle connection errors
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
};

module.exports = socketHandler;