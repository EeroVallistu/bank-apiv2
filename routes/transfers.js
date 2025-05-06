const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validateTransaction } = require('../middleware/validators');
const { sequelize, Account, Transaction, User } = require('../models');
const { Op } = require('sequelize');

// List all transfers
router.get('/', authenticate, async (req, res) => {
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
      // No need to swap account fields for external transactions anymore
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
        isExternal: tx.is_external
      };
    });
    
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

// Create new transfer (internal or external)
router.post('/', validateTransaction, authenticate, async (req, res) => {
  const { type = 'internal', ...transferData } = req.body;
  
  try {
    if (type === 'external') {
      // Forward to external transfer handler
      const externalTransferHandler = require('./transactions');
      return externalTransferHandler.handleExternalTransfer(req, res);
    } else {
      // Forward to internal transfer handler
      const internalTransferHandler = require('./transactions');
      return internalTransferHandler.handleInternalTransfer(req, res);
    }
  } catch (error) {
    console.error('Error processing transfer:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error processing transfer'
    });
  }
});

// Get transfer details
router.get('/:id', authenticate, async (req, res) => {
  try {
    // Use raw: false to get the Sequelize instance with proper mapping
    const transaction = await Transaction.findByPk(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaction not found'
      });
    }
    
    // Get user accounts
    const accounts = await Account.findAll({ 
      where: { user_id: req.user.id },
      attributes: ['account_number']
    });
    
    const accountNumbers = accounts.map(acc => acc.account_number);
    
    // Check if user is involved in this transaction
    if (!accountNumbers.includes(transaction.from_account) && !accountNumbers.includes(transaction.to_account)) {
      return res.status(403).json({
        status: 'error',
        message: 'You don\'t have access to this transaction'
      });
    }
    
    // Format the response using the Sequelize instance methods
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
      createdAt: transaction.created_at // Fixed: Use created_at instead of createdAt
    };
    
    res.status(200).json({
      status: 'success',
      data: formattedTransaction
    });
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching transaction details',
      details: error.message
    });
  }
});

module.exports = router;
