const { body, validationResult } = require('express-validator');

// Transaction validation middleware
const validateTransaction = [
  body('fromAccount').notEmpty().withMessage('Source account is required'),
  body('toAccount').notEmpty().withMessage('Destination account is required'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
  body('explanation').notEmpty().withMessage('Explanation is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = {
  validateTransaction
};
