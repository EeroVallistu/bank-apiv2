const { Transaction, Account } = require('../models');
const { Op } = require('sequelize');
const AuditLogger = require('./auditLogger');

/**
 * Anti-fraud and transaction limit enforcement
 */
class FraudDetection {
  /**
   * Check daily transaction limits
   */
  static async checkDailyLimit(accountNumber, amount, userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dailyTotal = await Transaction.sum('amount', {
      where: {
        sender_account: accountNumber,
        created_at: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        },
        status: ['completed', 'pending']
      }
    });

    const dailyLimit = parseFloat(process.env.DAILY_TRANSACTION_LIMIT) || 10000;
    const currentTotal = (dailyTotal || 0) + amount;

    if (currentTotal > dailyLimit) {
      await AuditLogger.logSecurityEvent(userId, 'DAILY_LIMIT_EXCEEDED', {
        accountNumber,
        requestedAmount: amount,
        dailyTotal: dailyTotal || 0,
        limit: dailyLimit
      });
      
      throw new Error(`Daily transaction limit of ${dailyLimit} exceeded`);
    }

    return true;
  }

  /**
   * Check for suspicious transaction patterns
   */
  static async checkSuspiciousActivity(accountNumber, amount, userId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Check for rapid consecutive transactions
    const recentTransactions = await Transaction.count({
      where: {
        sender_account: accountNumber,
        created_at: {
          [Op.gte]: oneHourAgo
        }
      }
    });

    if (recentTransactions > 10) {
      await AuditLogger.logSecurityEvent(userId, 'RAPID_TRANSACTIONS_DETECTED', {
        accountNumber,
        transactionCount: recentTransactions,
        timeWindow: '1 hour'
      });
      
      throw new Error('Too many transactions in short time period');
    }

    // Check for unusual large amounts
    const avgAmount = await Transaction.findOne({
      attributes: [
        [Transaction.sequelize.fn('AVG', Transaction.sequelize.col('amount')), 'avgAmount']
      ],
      where: {
        sender_account: accountNumber,
        created_at: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days
        }
      },
      raw: true
    });

    const averageAmount = parseFloat(avgAmount?.avgAmount) || 0;
    if (amount > averageAmount * 10 && amount > 1000) {
      await AuditLogger.logSecurityEvent(userId, 'UNUSUAL_AMOUNT_DETECTED', {
        accountNumber,
        requestedAmount: amount,
        averageAmount,
        threshold: averageAmount * 10
      });
      
      // Don't throw error, but flag for review
      return { flagged: true, reason: 'Unusual transaction amount' };
    }

    return { flagged: false };
  }

  /**
   * Check account velocity (number of unique recipients)
   */
  static async checkAccountVelocity(accountNumber, recipientAccount, userId) {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const uniqueRecipients = await Transaction.findAll({
      attributes: ['receiver_account'],
      where: {
        sender_account: accountNumber,
        created_at: {
          [Op.gte]: last24Hours
        }
      },
      group: ['receiver_account']
    });

    if (uniqueRecipients.length > 20) {
      await AuditLogger.logSecurityEvent(userId, 'HIGH_VELOCITY_DETECTED', {
        accountNumber,
        uniqueRecipients: uniqueRecipients.length,
        timeWindow: '24 hours'
      });
      
      throw new Error('Too many unique recipients in 24 hours');
    }

    return true;
  }

  /**
   * Comprehensive transaction validation
   */
  static async validateTransaction(fromAccount, toAccount, amount, userId) {
    const checks = await Promise.allSettled([
      this.checkDailyLimit(fromAccount, amount, userId),
      this.checkSuspiciousActivity(fromAccount, amount, userId),
      this.checkAccountVelocity(fromAccount, toAccount, userId)
    ]);

    const failures = checks
      .filter(result => result.status === 'rejected')
      .map(result => result.reason.message);

    if (failures.length > 0) {
      throw new Error(failures.join('; '));
    }

    // Check for flagged transactions
    const suspiciousCheck = checks[1];
    if (suspiciousCheck.status === 'fulfilled' && suspiciousCheck.value.flagged) {
      return { approved: true, flagged: true, reason: suspiciousCheck.value.reason };
    }

    return { approved: true, flagged: false };
  }
}

module.exports = FraudDetection;
