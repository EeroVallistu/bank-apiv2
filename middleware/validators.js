const { body, validationResult } = require('express-validator');
const PasswordUtils = require('../utils/passwordUtils');

// Password validation rules
const validatePassword = () => {
  return body('password')
    .isString().withMessage('Password must be a string')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .custom(value => {
      if (/^\s+$/.test(value)) {
        throw new Error('Password cannot consist of only spaces');
      }
      
      // Use PasswordUtils for comprehensive validation
      const validation = PasswordUtils.validatePasswordStrength(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      
      return true;
    });
};

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
  validateTransaction,
  validatePassword
};
