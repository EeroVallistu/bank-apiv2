const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validateTransaction } = require('../middleware/validators');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// List all transfers
router.get('/', authenticate, async (req, res) => {
  try {
    // Get user accounts
    const accounts = await Account.findAll({ 
      where: { userId: req.user.id },
      attributes: ['accountNumber']
    });
    
    const accountNumbers = accounts.map(acc => acc.accountNumber);
    
    // Find transactions where user is sender or receiver
    const transactions = await Transaction.findAll({
      where: {
        [Op.or]: [
          { fromAccount: { [Op.in]: accountNumbers } },
          { toAccount: { [Op.in]: accountNumbers } }
        ]
      },
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).json({
      status: 'success',
      data: transactions
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
      where: { userId: req.user.id },
      attributes: ['accountNumber']
    });
    
    const accountNumbers = accounts.map(acc => acc.accountNumber);
    
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

module.exports = router;
