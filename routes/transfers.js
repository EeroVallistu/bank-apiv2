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
      // For external transactions, we stored the accounts in reverse order
      let fromAccount = tx.from_account;
      let toAccount = tx.to_account;
      
      // If it's an external transaction, we need to swap the accounts back
      if (tx.is_external) {
        fromAccount = tx.to_account;
        toAccount = tx.from_account;
      }
      
      return {
        id: tx.id,
        fromAccount: fromAccount,
        toAccount: toAccount,
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
    
    // For external transactions, we stored the accounts in reverse order
    let fromAccount = transaction.from_account;
    let toAccount = transaction.to_account;
    
    // If it's an external transaction, we need to swap the accounts back
    if (transaction.is_external) {
      fromAccount = transaction.to_account;
      toAccount = transaction.from_account;
    }
    
    // Check if user is involved in this transaction (using the corrected account fields)
    if (!accountNumbers.includes(fromAccount) && !accountNumbers.includes(toAccount)) {
      return res.status(403).json({
        status: 'error',
        message: 'You don\'t have access to this transaction'
      });
    }
    
    // Format the response (with the corrected account fields)
    const formattedTransaction = {
      id: transaction.id,
      fromAccount: fromAccount,
      toAccount: toAccount,
      amount: parseFloat(transaction.amount),
      currency: transaction.currency,
      explanation: transaction.explanation,
      senderName: transaction.sender_name,
      receiverName: transaction.receiver_name,
      status: transaction.status,
      isExternal: transaction.is_external,
      createdAt: transaction.created_at
    };
    
    res.status(200).json({
      status: 'success',
      data: formattedTransaction
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error fetching transaction'
    });
  }
});

module.exports = router;
