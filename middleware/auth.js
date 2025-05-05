const jwt = require('jsonwebtoken');
const { findUserById, Session } = require('../models');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication token missing'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired token'
      });
    }

    // Find the session in the database
    const session = await Session.findOne({
      where: {
        token: token,
        expires_at: {
          [require('sequelize').Op.gt]: new Date()
        }
      }
    });

    if (!session) {
      return res.status(401).json({
        status: 'error', 
        message: 'Session expired or invalid'
      });
    }

    // Find the user
    const user = await findUserById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Add user and token to request object
    req.user = { id: user.id };
    req.token = token;
    req.sessionId = decoded.sessionId;
    
    // Continue to the next middleware/route handler
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Authentication failed'
    });
  }
}

module.exports = { authenticate };
