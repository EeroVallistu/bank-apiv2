const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const { checkPermission } = require('../middleware/checkPermission');
const { validateTransaction } = require('../middleware/validators');
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
const { fetch } = require('undici');
const currencyService = require('../services/currencyService');

const router = express.Router();

// Skip authentication for incoming B2B transfers
router.use('/incoming', (req, res, next) => {
  next();
});

// Explicitly handle removed endpoints to return 404
router.use('/internal', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

router.use('/external', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Apply authentication to all other routes
router.use((req, res, next) => {
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
 *       403:
 *         description: Permission denied
 */
router.get('/', async (req, res) => {
  try {
    // Get user accounts
    const accounts = await Account.findAll({ 
      where: { user_id: req.user.id },
      attributes: ['account_number']
    });
    
    const accountNumbers = accounts.map(acc => acc.account_number);
    
    // Find transactions where user is sender or receiver
    const transactions = await Transaction.findAll({
      where: {
        [Op.or]: [
          { from_account: { [Op.in]: accountNumbers } },
          { to_account: { [Op.in]: accountNumbers } }
        ]
      },
      order: [['created_at', 'DESC']]
    });
    
    // Format transaction data for response
    const formattedTransactions = transactions.map(tx => {
      return {
        id: tx.id,
        fromAccount: tx.from_account,
        toAccount: tx.to_account,
        amount: parseFloat(tx.amount),
        currency: tx.currency,
        explanation: tx.explanation,
        status: tx.status,
        createdAt: tx.created_at,
        senderName: tx.sender_name,
        receiverName: tx.receiver_name,
        isExternal: Boolean(tx.is_external),
        reference_id: tx.reference_id
      };
    });
    
    res.status(200).json({ data: formattedTransactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Error fetching transactions' });
  }
});

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
    const transaction = await Transaction.findByPk(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Get user accounts
    const accounts = await Account.findAll({ 
      where: { user_id: req.user.id },
      attributes: ['account_number']
    });
    
    const accountNumbers = accounts.map(acc => acc.account_number);
    
    // Check if user is involved in this transaction
    if (!accountNumbers.includes(transaction.from_account) && !accountNumbers.includes(transaction.to_account)) {
      return res.status(403).json({ error: "You don't have access to this transaction" });
    }
    
    // Format the response
    const formattedTransaction = {
      id: transaction.id,
      fromAccount: transaction.from_account,
      toAccount: transaction.to_account,
      amount: parseFloat(transaction.amount),
      currency: transaction.currency,
      explanation: transaction.explanation,
      senderName: transaction.sender_name,
      receiverName: transaction.receiver_name,
      status: transaction.status,
      isExternal: Boolean(transaction.is_external),
      created_at: transaction.created_at 
    };
    
    res.status(200).json({ data: formattedTransaction });
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json({ error: 'Error fetching transaction details', details: error.message });
  }
});

// Internal and external transfer endpoints have been completely removed
// Only the unified endpoint at '/' handles transfers now

/**
 * @swagger
 * /transfers:
 *   post:
 *     summary: Create a new transfer (internal or external)
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
  '/',
  authenticate,
  checkPermission('transactions', 'create'),
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
        return res.status(400).json({ error: 'Validation failed', details: errors.array() });
      }

      const { fromAccount, toAccount, amount, explanation } = req.body;

      // Check if source account belongs to user
      const sourceAccount = await findAccountByNumber(fromAccount);
      if (!sourceAccount || sourceAccount.user_id !== req.user.id) {
        return res.status(404).json({ error: "Source account not found or doesn't belong to you" });
      }

      // Check if source account has sufficient funds
      if (sourceAccount.balance < amount) {
        return res.status(402).json({ error: 'Insufficient funds' });
      }

      // Extract the bank prefix from toAccount (first 3 characters)
      const bankPrefix = toAccount.substring(0, 3);
      
      // Determine if this is an internal or external transfer
      const ourBankPrefix = await centralBankService.getOurBankPrefix();
      const isExternal = bankPrefix !== ourBankPrefix;
      
      if (isExternal) {
        console.log('Processing as external transfer');
        return processExternalTransfer(req, res);
      } else {
        console.log('Processing as internal transfer');
        return processInternalTransfer(req, res);
      }
    } catch (error) {
      console.error('Error processing unified transfer:', error);
      res.status(500).json({ error: 'Error processing transfer' });
    }
  }
);

// Process internal transfer
const processInternalTransfer = async (req, res) => {
  try {
    const { fromAccount, toAccount, amount, explanation } = req.body;

    // Check if source account belongs to user (already validated in the unified handler)
    const sourceAccount = await findAccountByNumber(fromAccount);
    
    // Check if destination account exists in our bank
    const destinationAccount = await findAccountByNumber(toAccount);
    if (!destinationAccount) {
      return res.status(404).json({ error: 'Destination account not found' });
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

    // Find source account owner for the sender name
    const sourceUser = await findUserById(sourceAccount.user_id);
    // Find destination account owner for the receiver name
    const destinationUser = await findUserById(destinationAccount.user_id);

    // Start a database transaction to ensure consistency
    const dbTransaction = await sequelize.transaction();

    try {
      // Create a transaction record in database
      const transaction = await Transaction.create({
        from_account: fromAccount,
        to_account: toAccount,
        amount: convertedAmount,
        original_amount: parseFloat(amount),
        original_currency: sourceAccount.currency,
        currency: destinationAccount.currency,
        exchange_rate: exchangeRate,
        explanation,
        sender_name: sourceUser.full_name,
        receiver_name: destinationUser.full_name,
        is_external: false,
        status: 'completed',
        created_at: new Date()
      }, { transaction: dbTransaction });

      // Update balances
      sourceAccount.balance -= parseFloat(amount);
      await sourceAccount.save({ transaction: dbTransaction });
      
      destinationAccount.balance += convertedAmount;
      await destinationAccount.save({ transaction: dbTransaction });

      // Commit the transaction
      await dbTransaction.commit();

      // Format response data - simplified for internal transfers
      const transactionData = {
        fromAccount: transaction.from_account,
        toAccount: transaction.to_account,
        amount: parseFloat(transaction.amount),
        explanation: transaction.explanation
      };

      res.status(201).json({ data: transactionData });
      
    } catch (dbError) {
      // Rollback the transaction on error
      await dbTransaction.rollback();
      throw dbError;
    }
  } catch (error) {
    console.error('Error creating internal transaction:', error);
    res.status(500).json({ error: 'Error creating internal transaction' });
  }
};

// Process external transfer
const processExternalTransfer = async (req, res) => {
  try {
    const { fromAccount, toAccount, amount, explanation } = req.body;

    // Check if source account belongs to user (already validated in the unified handler)
    const sourceAccount = await findAccountByNumber(fromAccount);

    // Extract the bank prefix from toAccount (first 3 characters)
    const bankPrefix = toAccount.substring(0, 3);
    
    // Check if this is actually an external transaction
    const ourBankPrefix = await centralBankService.getOurBankPrefix();
    // We no longer reject internal transfers in this handler since the unified endpoint uses it

    // Find source account owner for the sender name
    const sourceUser = await findUserById(sourceAccount.user_id);

    // Start a database transaction to ensure consistency
    const dbTransaction = await sequelize.transaction();
    
    try {
      // Create a transaction record in database
      const transaction = await Transaction.create({
        from_account: fromAccount,
        to_account: toAccount,
        amount: parseFloat(amount),
        original_amount: parseFloat(amount),
        original_currency: sourceAccount.currency,
        currency: sourceAccount.currency,
        exchange_rate: 1,
        explanation,
        sender_name: sourceUser.full_name,
        is_external: true,
        status: 'pending',
        created_at: new Date()
      }, { transaction: dbTransaction });

      try {
        console.log(`Looking up bank with prefix: ${bankPrefix}`);
        
        // Get destination bank details from central bank
        const bankDetails = await centralBankService.getBankDetails(bankPrefix);
        
        if (!bankDetails) {
          // Update transaction status to failed
          await transaction.update({ 
            status: 'failed',
            explanation: explanation + ' (Destination bank not found)'
          }, { transaction: dbTransaction });
          
          await dbTransaction.commit();
          
          console.error(`No bank found with prefix ${bankPrefix}`);
          return res.status(404).json({ error: 'Destination bank not found' });
        }
        
        console.log(`Found bank: ${bankDetails.name} (${bankDetails.bankPrefix})`);
        console.log(`Transaction URL: ${bankDetails.transactionUrl}`);

        // Update transaction status to pending
        await transaction.update({ status: 'pending' }, { transaction: dbTransaction });

        // Prepare payload for B2B transaction
        const payload = {
          accountFrom: fromAccount,
          accountTo: toAccount,
          currency: sourceAccount.currency,
          amount,
          explanation,
          senderName: sourceUser.full_name,
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
          
          // Update transaction as failed
          await transaction.update({ 
            status: 'failed',
            explanation: explanation + ` (Error: ${response.status})`
          }, { transaction: dbTransaction });
          
          await dbTransaction.commit();
          
          throw new Error(`Destination bank responded with status: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log(`Transaction successful:`, result);
        
        // Update transaction with receiver name if provided
        let updateFields = { status: 'completed' };
        if (result && result.receiverName) {
          updateFields.receiver_name = result.receiverName;
        }
        
        await transaction.update(updateFields, { transaction: dbTransaction });

        // Update source account balance
        sourceAccount.balance -= parseFloat(amount);
        await sourceAccount.save({ transaction: dbTransaction });
        
        // Commit the database transaction
        await dbTransaction.commit();

        // Format response data - simplified format for external transfers
        const transactionData = {
          fromAccount: transaction.from_account,
          toAccount: transaction.to_account,
          amount: parseFloat(transaction.amount),
          explanation: transaction.explanation
        };

        res.status(201).json({ data: transactionData });
      } catch (error) {
        // Transaction failed
        console.error('External transfer error:', error);
        
        // Only rollback if we haven't committed already
        if (!dbTransaction.finished) {
          await transaction.update({ 
            status: 'failed',
            explanation: explanation + ` (Error: ${error.message})`
          }, { transaction: dbTransaction });
          
          await dbTransaction.commit();
        }
        
        res.status(500).json({ error: `External transfer failed: ${error.message}` });
      }
    } catch (dbError) {
      // Rollback the transaction on database error
      if (!dbTransaction.finished) {
        await dbTransaction.rollback();
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error creating external transaction:', error);
    res.status(500).json({ error: 'Error creating external transaction' });
  }
};

// Handle route for incoming B2B transfers from other banks
router.post('/incoming', async (req, res) => {
  // This endpoint needs to be implemented if it exists in the original files
  // Since it wasn't visible in the shown code, we're leaving a placeholder
  res.status(501).json({ error: 'Not implemented' });
});

module.exports = router;