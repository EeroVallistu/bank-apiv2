const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const { 
  User,
  findUserByUsername, 
  findUserByEmail, 
  findUserById,
  Session
} = require('../models');
const { Op } = require('sequelize');

const userRouter = express.Router();
const sessionRouter = express.Router();

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Register a new user
 *     tags: [Users]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - fullName
 *               - email
 *             properties:
 *               username:
 *                 type: string
 *                 example: jsmith
 *               password:
 *                 type: string
 *                 example: securePass123!
 *               fullName:
 *                 type: string
 *                 example: John Smith
 *               email:
 *                 type: string
 *                 example: john.smith@example.com
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 */
userRouter.post(
  '/',
  [
    body('username')
      .isString()
      .trim()
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters'),
    body('password')
      .isString()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('fullName')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Full name is required'),
    body('email')
      .isString()
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ status: 'error', errors: errors.array() });
      }

      const { username, password, fullName, email } = req.body;

      // Check if user exists using Sequelize models
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { username: username },
            { email: email }
          ]
        }
      });
      
      if (existingUser) {
        return res.status(409).json({ 
          status: 'error',
          message: 'Username or email already in use'
        });
      }

      // Create new user with Sequelize
      await User.create({
        username,
        password, // WARNING: Storing plain text password (not secure!)
        full_name: fullName,
        email,
        is_active: true
      });

      res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Server error during registration',
      });
    }
  }
);

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Unauthorized
 */
userRouter.get('/me', authenticate, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Remove password from response
    const userData = user.toJSON();
    delete userData.password;
    
    // Transform full_name to fullName for consistent API response
    userData.fullName = userData.full_name;
    delete userData.full_name;

    res.status(200).json({
      status: 'success',
      data: userData
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error fetching profile',
    });
  }
});

/**
 * @swagger
 * /sessions:
 *   post:
 *     summary: Login user
 *     tags: [Users]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: jsmith
 *               password:
 *                 type: string
 *                 example: securePass123!
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     username:
 *                       type: string
 *                       example: jsmith
 *                     fullName:
 *                       type: string
 *                       example: John Smith
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Invalid credentials
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       msg:
 *                         type: string
 *                         example: Username is required
 *                       param:
 *                         type: string
 *                         example: username
 */
sessionRouter.post(
  '/',
  [
    body('username').notEmpty().trim().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          status: 'error', 
          errors: errors.array() 
        });
      }

      const { username, password } = req.body;

      const user = await findUserByUsername(username);
      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials',
        });
      }

      // Simple password check (not secure!)
      if (user.password !== password) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid credentials',
        });
      }

      // Generate unique session ID
      const sessionId = require('crypto').randomBytes(32).toString('hex');
      
      const token = jwt.sign({ 
        userId: user.id,
        sessionId
      }, process.env.JWT_SECRET, {
        expiresIn: '24h'
      });

      // Store session in database
      const expiresAt = new Date(Date.now() + 24*60*60*1000);
      
      await Session.create({
        user_id: user.id,
        token,
        expires_at: expiresAt,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      // Clean up expired sessions
      await Session.destroy({
        where: {
          user_id: user.id,
          expires_at: {
            [Op.lt]: new Date()
          }
        }
      });

      // Format user data to match the OpenAPI spec
      res.json({
        status: 'success',
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Server error during login',
      });
    }
  }
);

sessionRouter.delete('/', authenticate, async (req, res) => {
  try {
    // Delete the current session from database
    await Session.destroy({
      where: {
        token: req.token
      }
    });
    
    res.json({
      status: 'success',
      message: 'Successfully logged out'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error during logout',
    });
  }
});


sessionRouter.delete('/logout', authenticate, async (req, res) => {
  try {
    // Delete the current session from database
    await Session.destroy({
      where: {
        token: req.token
      }
    });
    
    res.json({
      status: 'success',
      message: 'Successfully logged out'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error during logout',
    });
  }
});

// Export both routers
module.exports = {
  userRoutes: userRouter,
  sessionRoutes: sessionRouter
};
