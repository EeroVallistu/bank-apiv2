const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const { 
  Account,
  Transaction,
  User,
  findAccountByNumber, 
  findUserById,
  findAccountsByUserId,
  findTransactionById,
  sequelize
} = require('../models');
const { Op } = require('sequelize');
const keyManager = require('../utils/keyManager');
const centralBankService = require('../services/centralBankService');
const fetch = require('node-fetch');
const currencyService = require('../services/currencyService');

const router = express.Router();

// All routes require authentication except specific endpoints
router.use((req, res, next) => {
  if (req.path === '/incoming') {
    // Skip authentication for incoming B2B transfers
    return next();
  }
  authenticate(req, res, next);
});

/**
 * @swagger
 * /transfers:
 *   get:
 *     summary: Get all transactions for the user
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user transactions
 *       401:
 *         description: Unauthorized
 */
router.get('/', async (req, res) => {
  try {
    // Get user accounts from database
    const userAccounts = await findAccountsByUserId(req.user.id);
    const accountNumbers = userAccounts.map(acc => acc.account_number);
    
    // Find transactions where user is sender or receiver
    const userTransactions = await Transaction.findAll({
      where: {
        [Op.or]: [
          { from_account: { [Op.in]: accountNumbers } },
          { to_account: { [Op.in]: accountNumbers } }
        ]
      },
      order: [['created_at', 'DESC']] // Updated to use snake_case (created_at) instead of camelCase (createdAt)
    });
    
    // Format transactions for response
    const formattedTransactions = userTransactions.map(tx => ({
      id: tx.id,
      fromAccount: tx.from_account,
      toAccount: tx.to_account,
      amount: parseFloat(tx.amount),
      currency: tx.currency,
      explanation: tx.explanation,
      status: tx.status,
      createdAt: tx.created_at, // Make sure we're using the correct field name here too
      sender_name: tx.sender_name,
      receiver_name: tx.receiver_name,
      is_external: tx.is_external,
      reference_id: tx.reference_id,
    }));
    
    res.status(200).json({
      status: 'success',
      data: formattedTransactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching transactions'
    });
  }
});

/**
 * @swagger
 * /transfers/internal:
 *   post:
 *     summary: Create a new internal transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromAccount
 *               - toAccount
 *               - amount
 *               - explanation
 *             properties:
 *               fromAccount:
 *                 type: string
 *                 example: 353c8b72e4a9f15d3b82
 *               toAccount:
 *                 type: string
 *                 example: 353f9a23d1c7b45e8t91
 *               amount:
 *                 type: number
 *                 example: 150.00
 *               explanation:
 *                 type: string
 *                 example: Rent payment for January
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     fromAccount:
 *                       type: string
 *                       example: 353c8b72e4a9f15d3b82
 *                     toAccount:
 *                       type: string
 *                       example: 353f9a23d1c7b45e8t91
 *                     amount:
 *                       type: number
 *                       example: 150.00
 *                     currency:
 *                       type: string
 *                       example: EUR
 *                     explanation:
 *                       type: string
 *                       example: Rent payment for January
 *                     status:
 *                       type: string
 *                       example: completed
 *       400:
 *         description: Validation error
 *       402:
 *         description: Insufficient funds
 *       404:
 *         description: Account not found
 */
router.post(
  '/internal',
  [
    body('fromAccount').notEmpty().withMessage('Source account is required'),
    body('toAccount').notEmpty().withMessage('Destination account is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('explanation').notEmpty().withMessage('Explanation is required'),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          status: 'error', 
          errors: errors.array() 
        });
      }

      const { fromAccount, toAccount, amount, explanation } = req.body;

      // Check if source account belongs to user
      const sourceAccount = await findAccountByNumber(fromAccount);
      if (!sourceAccount || sourceAccount.user_id !== req.user.id) {
        return res.status(404).json({
          status: 'error',
          message: 'Source account not found or doesn\'t belong to you'
        });
      }

      // Check if destination account exists in our bank
      const destinationAccount = await findAccountByNumber(toAccount);
      if (!destinationAccount) {
        return res.status(404).json({
          status: 'error',
          message: 'Destination account not found'
        });
      }

      // Convert amount if currencies are different
      let convertedAmount = parseFloat(amount);
      let exchangeRate = 1;
      
      if (sourceAccount.currency !== destinationAccount.currency) {
        convertedAmount = await currencyService.convert(
          amount,
          sourceAccount.currency,
          destinationAccount.currency
        );
        exchangeRate = convertedAmount / amount;
      }

      // Check if source account has sufficient funds
      if (sourceAccount.balance < amount) {
        return res.status(402).json({
          status: 'error',
          message: 'Insufficient funds'
        });
      }

      // Find source account owner for the sender name
      const sourceUser = findUserById(sourceAccount.userId);
      // Find destination account owner for the receiver name
      const destinationUser = findUserById(destinationAccount.userId);

      // Create a transaction
      const transaction = {
        id: generateTransactionId(),
        fromAccount,
        toAccount,
        amount: convertedAmount,
        originalAmount: parseFloat(amount),
        originalCurrency: sourceAccount.currency,
        currency: destinationAccount.currency,
        exchangeRate,
        explanation,
        senderName: sourceUser.fullName,
        receiverName: destinationUser.fullName,
        isExternal: false,
        status: 'completed',
        createdAt: new Date().toISOString()
      };

      // Update balances
      sourceAccount.balance -= parseFloat(amount);
      destinationAccount.balance += convertedAmount;

      // Add transaction to store
      transactions.push(transaction);

      res.status(201).json({
        status: 'success',
        data: transaction
      });
    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error creating transaction'
      });
    }
  }
);

/**
 * @swagger
 * /transfers/external:
 *   post:
 *     summary: Create a new external transaction
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromAccount
 *               - toAccount
 *               - amount
 *               - explanation
 *             properties:
 *               fromAccount:
 *                 type: string
 *               toAccount:
 *                 type: string
 *               amount:
 *                 type: number
 *               explanation:
 *                 type: string
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *       400:
 *         description: Validation error
 *       402:
 *         description: Insufficient funds
 *       404:
 *         description: Account not found
 */
router.post(
  '/external',
  [
    body('fromAccount').notEmpty().withMessage('Source account is required'),
    body('toAccount').notEmpty().withMessage('Destination account is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('explanation').notEmpty().withMessage('Explanation is required'),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          status: 'error', 
          errors: errors.array() 
        });
      }

      const { fromAccount, toAccount, amount, explanation } = req.body;

      // Check if source account belongs to user
      const sourceAccount = findAccountByNumber(fromAccount);
      if (!sourceAccount || sourceAccount.userId !== req.user.id) {
        return res.status(404).json({
          status: 'error',
          message: 'Source account not found or doesn\'t belong to you'
        });
      }

      // Check if source account has sufficient funds
      if (sourceAccount.balance < amount) {
        return res.status(402).json({
          status: 'error',
          message: 'Insufficient funds'
        });
      }

      // Extract the bank prefix from toAccount (first 3 characters)
      const bankPrefix = toAccount.substring(0, 3);
      
      // Check if this is actually an external transaction
      if (bankPrefix === process.env.BANK_PREFIX) {
        return res.status(400).json({
          status: 'error',
          message: 'For internal transfers please use /internal endpoint'
        });
      }

      // Find source account owner for the sender name
      const sourceUser = findUserById(sourceAccount.userId);

      // Create a transaction
      const transaction = {
        id: generateTransactionId(),
        fromAccount,
        toAccount,
        amount: parseFloat(amount),
        originalAmount: parseFloat(amount),
        originalCurrency: sourceAccount.currency,
        currency: sourceAccount.currency,
        exchangeRate: 1, // Will be updated by receiving bank
        explanation,
        senderName: sourceUser.fullName,
        bankPrefix,
        isExternal: true,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Add to transactions array
      transactions.push(transaction);

      try {
        console.log(`Looking up bank with prefix: ${bankPrefix}`);
        
        // Get destination bank details from central bank
        const bankDetails = await centralBankService.getBankDetails(bankPrefix);
        
        if (!bankDetails) {
          transaction.status = 'failed';
          transaction.errorMessage = 'Destination bank not found';
          
          console.error(`No bank found with prefix ${bankPrefix}`);
          return res.status(404).json({
            status: 'error',
            message: 'Destination bank not found'
          });
        }
        
        console.log(`Found bank: ${bankDetails.name} (${bankDetails.bankPrefix})`);
        console.log(`Transaction URL: ${bankDetails.transactionUrl}`);

        // Update transaction status to in-progress
        transaction.status = 'inProgress';

        // Prepare payload for B2B transaction
        const payload = {
          accountFrom: fromAccount,
          accountTo: toAccount,
          currency: sourceAccount.currency,
          amount,
          explanation,
          senderName: sourceUser.fullName,
          originalCurrency: sourceAccount.currency
        };

        // Sign the payload with our private key
        const jwtToken = keyManager.sign(payload);
        
        console.log(`Sending transaction to ${bankDetails.transactionUrl}`);
        
        // Send to destination bank's B2B endpoint
        const response = await fetch(bankDetails.transactionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ jwt: jwtToken })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Destination bank responded with error: ${response.status}`, errorText);
          throw new Error(`Destination bank responded with status: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log(`Transaction successful:`, result);
        
        // Update receiver name if provided
        if (result && result.receiverName) {
          transaction.receiverName = result.receiverName;
        }

        // Update balances - fix for in-memory data
        sourceAccount.balance -= parseFloat(amount);

        // Complete the transaction
        transaction.status = 'completed';

        res.status(201).json({
          status: 'success',
          data: transaction
        });
      } catch (error) {
        // Transaction failed
        console.error('External transfer error:', error);
        
        transaction.status = 'failed';
        transaction.errorMessage = error.message;
        
        res.status(500).json({
          status: 'error',
          message: `External transfer failed: ${error.message}`
        });
      }
    } catch (error) {
      console.error('Error creating external transaction:', error);
      res.status(500).json({
        status: 'error',
        message: 'Error creating external transaction'
      });
    }
  }
);

/**
 * @swagger
 * /transfers/{id}:
 *   get:
 *     summary: Get transaction details
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction details
 *       404:
 *         description: Transaction not found
 */
router.get('/:id', async (req, res) => {
  try {
    const transaction = findTransactionById(parseInt(req.params.id));
    
    if (!transaction) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaction not found'
      });
    }
    
    // Get user accounts
    const userAccounts = findAccountsByUserId(req.user.id);
    const accountNumbers = userAccounts.map(acc => acc.accountNumber);
    
    // Check if user is involved in this transaction
    if (!accountNumbers.includes(transaction.fromAccount) && !accountNumbers.includes(transaction.toAccount)) {
      return res.status(403).json({
        status: 'error',
        message: 'You don\'t have access to this transaction'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: transaction
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching transaction'
    });
  }
});

// Add helper methods for the routers
router.handleInternalTransfer = async (req, res) => {
  req.body.type = 'internal';
  return router.post('/internal', req, res);
};

router.handleExternalTransfer = async (req, res) => {
  req.body.type = 'external';
  return router.post('/external', req, res);
};

module.exports = router;
