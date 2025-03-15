const jwt = require('jsonwebtoken');
const { findUserById } = require('../models/inMemoryStore');
const { AuthenticationError } = require('../utils/errors');

const authenticate = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Authentication token required');
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthenticationError('Token expired');
      }
      throw new AuthenticationError('Invalid token');
    }
    
    // Get user
    const user = findUserById(decoded.userId);
    
    if (!user) {
      throw new AuthenticationError('User not found');
    }
    
    // Check if token exists in user's sessions
    const sessionExists = user.sessions.some(session => 
      session.token === token && new Date(session.expiresAt) > new Date()
    );
    
    if (!sessionExists) {
      throw new AuthenticationError('Session invalid or expired');
    }
    
    // Add user info to request
    req.user = {
      id: user.id,
      username: user.username
    };
    req.token = token;
    
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticate
};
