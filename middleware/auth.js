const jwt = require('jsonwebtoken');
const { findUserById, Session } = require('../models');
const { Op } = require('sequelize');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication token missing' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Find the session in the database with exact token match
    const session = await Session.findOne({
      where: {
        token: {
          [Op.eq]: token  // Use exact equality operator
        },
        expires_at: {
          [Op.gt]: new Date() // Check that the session hasn't expired
        }
      }
    });

    if (!session) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Find the user with role information
    const user = await findUserById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Add user and token to request object
    req.user = user;
    req.token = token;
    req.sessionId = decoded.sessionId;
    
    // Continue to the next middleware/route handler
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

module.exports = { authenticate };
