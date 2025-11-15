const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const { validate, schemas } = require('../utils/validators');
const prisma = require('../services/prisma');
const { NotFoundError, AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');

// Apply auth middleware
router.use(authMiddleware);

// @route   POST /api/collaboration/boards/:boardId/share
// @desc    Share board with users
// @access  Private
router.post('/boards/:boardId/share', validate(schemas.shareBoard), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const { emails, permission } = req.body;

    // Check ownership
    const board = await prisma.board.findFirst({
      where: { id: boardId, userId: req.user.id, isDeleted: false },
    });

    if (!board) {
      throw new AuthorizationError('You can only share your own boards');
    }

    // Find users by email
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
    });

    if (users.length === 0) {
      throw new NotFoundError('No users found with provided emails');
    }

    // Create collaborator entries
    const collaborators = await Promise.all(
      users.map((user) =>
        prisma.boardCollaborator.upsert({
          where: {
            boardId_userId: {
              boardId,
              userId: user.id,
            },
          },
          create: {
            boardId,
            userId: user.id,
            permission: permission || 'edit',
          },
          update: {
            permission: permission || 'edit',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })
      )
    );

    logger.info(`Board ${boardId} shared with ${users.length} users by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Board shared successfully',
      data: { collaborators },
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/collaboration/boards/:boardId/collaborators
// @desc    Get board collaborators
// @access  Private
router.get('/boards/:boardId/collaborators', async (req, res, next) => {
  try {
    const { boardId } = req.params;

    // Check access
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [
          { userId: req.user.id },
          {
            collaborators: {
              some: { userId: req.user.id },
            },
          },
        ],
        isDeleted: false,
      },
    });

    if (!board) {
      throw new NotFoundError('Board not found or access denied');
    }

    const collaborators = await prisma.boardCollaborator.findMany({
      where: { boardId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: { collaborators },
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/collaboration/boards/:boardId/collaborators/:userId
// @desc    Remove collaborator
// @access  Private
router.delete('/boards/:boardId/collaborators/:userId', async (req, res, next) => {
  try {
    const { boardId, userId } = req.params;

    // Check ownership
    const board = await prisma.board.findFirst({
      where: { id: boardId, userId: req.user.id, isDeleted: false },
    });

    if (!board) {
      throw new AuthorizationError('Only board owner can remove collaborators');
    }

    await prisma.boardCollaborator.delete({
      where: {
        boardId_userId: {
          boardId,
          userId,
        },
      },
    });

    logger.info(`Collaborator ${userId} removed from board ${boardId} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Collaborator removed successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
