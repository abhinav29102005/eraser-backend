const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { AuthenticationError } = require('../utils/errors');

const generateToken = (payload) => {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch (error) {
    throw new AuthenticationError('Invalid or expired token');
  }
};

const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
};
