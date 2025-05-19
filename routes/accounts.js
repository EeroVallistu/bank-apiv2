const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { 
  Account,
  User,
  findAccountsByUserId, 
  findAccountByNumber, 
  generateAccountNumber 
} = require('../models');
const { 
  NotFoundError, 
  ValidationError,
  errorUtils
} = require('../utils/errors');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     Account:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Account ID
 *         accountNumber:
 *           type: string
 *           description: Unique account number with bank prefix
 *         userId:
 *           type: integer
 *           description: ID of the account owner
 *         balance:
 *           type: number
 *           format: float
 *           description: Current account balance
 *         currency:
 *           type: string
 *           enum: [EUR, USD, GBP]
 *           description: Account currency
 *         name:
 *           type: string
 *           description: Account name/description
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Account creation date
 *       required:
 *         - accountNumber
 *         - userId
 *         - currency
 *         - name
 */

/**
 * @swagger
 * /accounts:
 *   get:
 *     summary: Get all user accounts
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user accounts
 *       401:
 *         description: Unauthorized
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get accounts from database
    const accounts = await findAccountsByUserId(userId);
    
    const formattedAccounts = accounts.map(account => ({
      id: account.id,
      accountNumber: account.account_number,
      userId: account.user_id,
      balance: parseFloat(account.balance),
      currency: account.currency,
      name: account.name
    }));

    res.status(200).json({ data: formattedAccounts });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Server error fetching accounts' });
  }
});

/**
 * @swagger
 * /accounts:
 *   post:
 *     summary: Create a new account
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - currency
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the account
 *                 example: "Main Account"
 *               currency:
 *                 type: string
 *                 description: Currency code
 *                 enum: [EUR, USD, GBP, SEK]
 *                 example: "EUR"
 *     responses:
 *       201:
 *         description: Account created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  [
    body('name')
      .isString()
      .notEmpty()
      .withMessage('Account name is required'),
    body('currency')
      .isString()
      .isIn(['EUR', 'USD', 'GBP', 'SEK'])
      .withMessage('Currency must be one of: EUR, USD, GBP, SEK')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }
      
      const { name, currency } = req.body;
      const userId = req.user.id;
      
      // Generate account number
      const accountNumber = await generateAccountNumber();
      
      // Create the account in the database
      const newAccount = await Account.create({
        account_number: accountNumber,
        user_id: userId,
        balance: 1000.00,
        currency,
        name,
        is_active: true
      });

      res.status(201).json({
        message: 'Account created successfully',
        data: {
          id: newAccount.id,
          accountNumber: newAccount.account_number,
          userId: newAccount.user_id,
          balance: parseFloat(newAccount.balance),
          currency: newAccount.currency,
          name: newAccount.name,
          created_at: newAccount.created_at
        }
      });
    } catch (error) {
      console.error('Create account error:', error);
      res.status(500).json({ error: 'Server error creating account' });
    }
  }
);

/**
 * @swagger
 * /accounts/{accountNumber}:
 *   get:
 *     summary: Get account details
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: accountNumber
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Account not found
 */
router.get('/:accountNumber', async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const userId = req.user.id;
    
    // Find account in database
    const account = await findAccountByNumber(accountNumber);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Verify account belongs to user
    if (account.user_id !== userId) {
      return res.status(403).json({ error: 'You do not have permission to access this account' });
    }

    res.status(200).json({
      data: {
        id: account.id,
        accountNumber: account.account_number,
        userId: account.user_id,
        balance: parseFloat(account.balance),
        currency: account.currency,
        name: account.name,
        created_at: account.created_at
      }
    });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ error: 'Server error fetching account' });
  }
});

module.exports = router;
