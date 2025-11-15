const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const { validate, schemas } = require('../utils/validators');
const prisma = require('../services/prisma');
const { NotFoundError, AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');

// Apply auth middleware to all routes
router.use(authMiddleware);

// @route   GET /api/boards
// @desc    Get all boards for current user
// @access  Private
router.get('/', async (req, res, next) => {
  try {
    const boards = await prisma.board.findMany({
      where: {
        OR: [
          { userId: req.user.id },
          {
            collaborators: {
              some: {
                userId: req.user.id,
              },
            },
          },
        ],
        isDeleted: false,
      },
      orderBy: { lastEditedAt: 'desc' },
      select: {
        id: true,
        title: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
        lastEditedAt: true,
        userId: true,
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
      data: {
        boards,
        count: boards.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/boards
// @desc    Create new board
// @access  Private
router.post('/', validate(schemas.createBoard), async (req, res, next) => {
  try {
    const { title } = req.body;

    const board = await prisma.board.create({
      data: {
        title: title || 'Untitled Board',
        userId: req.user.id,
        documentState: [],
      },
      select: {
        id: true,
        title: true,
        documentState: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info(`Board created: ${board.id} by ${req.user.email}`);

    res.status(201).json({
      success: true,
      message: 'Board created successfully',
      data: { board },
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/boards/:id
// @desc    Get board by ID
// @access  Private
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const board = await prisma.board.findFirst({
      where: {
        id,
        OR: [
          { userId: req.user.id },
          {
            collaborators: {
              some: {
                userId: req.user.id,
              },
            },
          },
          { isPublic: true },
        ],
        isDeleted: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        collaborators: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!board) {
      throw new NotFoundError('Board not found or access denied');
    }

    res.json({
      success: true,
      data: { board },
    });
  } catch (error) {
    next(error);
  }
});

// @route   PATCH /api/boards/:id
// @desc    Update board
// @access  Private
router.patch('/:id', validate(schemas.updateBoard), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, isPublic } = req.body;

    // Check ownership
    const existingBoard = await prisma.board.findFirst({
      where: { id, userId: req.user.id, isDeleted: false },
    });

    if (!existingBoard) {
      throw new AuthorizationError('You can only update your own boards');
    }

    const board = await prisma.board.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(typeof isPublic === 'boolean' && { isPublic }),
        lastEditedAt: new Date(),
      },
    });

    logger.info(`Board updated: ${board.id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Board updated successfully',
      data: { board },
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/boards/:id
// @desc    Delete board (soft delete)
// @access  Private
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check ownership
    const existingBoard = await prisma.board.findFirst({
      where: { id, userId: req.user.id, isDeleted: false },
    });

    if (!existingBoard) {
      throw new AuthorizationError('You can only delete your own boards');
    }

    await prisma.board.update({
      where: { id },
      data: { isDeleted: true },
    });

    logger.info(`Board deleted: ${id} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'Board deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
