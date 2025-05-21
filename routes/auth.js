const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const xss = require('xss');
const { validatePassword } = require('../middleware/validators');

// Configure XSS with NO allowlist for user data
const xssOptions = {
  whiteList: {}, // Empty whitelist means NO tags allowed
  stripIgnoreTag: false, // Don't strip tags - encode them as HTML entities instead
  escapeHtmlTag: true, // Encode < and > as &lt; and &gt;
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object']
};
const strictXss = new xss.FilterXSS(xssOptions);
const { authenticate } = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');
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
    validatePassword(),
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
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
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
        return res.status(409).json({ error: 'Username or email already in use' });
      }


      // Find the default 'user' role
      const { Role } = require('../models');
      const userRole = await Role.findOne({ where: { name: 'user' } });
      if (!userRole) {
        return res.status(500).json({ error: "Default user role not found. Please check roles table." });
      }

      // Sanitize inputs with strict XSS filter to prevent any HTML tags
      const sanitizedUsername = strictXss.process(username);
      const sanitizedFullName = strictXss.process(fullName);
      const sanitizedEmail = strictXss.process(email);
      
      // Create new user with sanitized data
      await User.create({
        username: sanitizedUsername,
        password, // WARNING: Storing plain text password (not secure!)
        full_name: sanitizedFullName,
        email: sanitizedEmail,
        is_active: true,
        role_id: userRole.id
      });

      res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Server error during registration' });
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
 *       403:
 *         description: Permission denied
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Permission denied
 */
userRouter.get('/me', authenticate, checkPermission('users', 'read'), async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove password from response
    const userData = user.toJSON();
    delete userData.password;
    
    // Transform snake_case to camelCase for consistent API response
    const transformedData = {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      fullName: userData.full_name
    };

    res.status(200).json({ data: transformedData });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error fetching profile' });
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
    validatePassword()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { username, password } = req.body;

      const user = await findUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Simple password check (not secure!)
      if (user.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
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

      // Only return the token with no status
      res.json({
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Server error during login' });
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
    
    res.status(204).send();
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error during logout' });
  }
});

// Export both routers
module.exports = {
  userRoutes: userRouter,
  sessionRoutes: sessionRouter
};
