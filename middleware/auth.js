const jwt = require('jsonwebtoken');
const { findUserById } = require('../models/inMemoryStore');

const authenticate = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user
    const user = findUserById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // Check if token exists in user's sessions
    const sessionExists = user.sessions.some(session => 
      session.token === token && new Date(session.expiresAt) > new Date()
    );
    
    if (!sessionExists) {
      return res.status(401).json({
        status: 'error',
        message: 'Session invalid or expired'
      });
    }
    
    // Add user info to request
    req.user = {
      id: user.id,
      username: user.username
    };
    req.token = token;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      status: 'error',
      message: 'Authentication failed: ' + error.message
    });
  }
};

module.exports = {
  authenticate
};
