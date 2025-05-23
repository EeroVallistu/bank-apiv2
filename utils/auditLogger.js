const { Log } = require('../models');

/**
 * Comprehensive audit logging system for security and compliance
 */
class AuditLogger {
  /**
   * Log user authentication events
   */
  static async logAuthEvent(userId, action, details = {}) {
    await this.logEvent('AUTH', userId, action, details);
  }

  /**
   * Log financial transactions
   */
  static async logTransaction(userId, action, transactionData) {
    await this.logEvent('TRANSACTION', userId, action, {
      amount: transactionData.amount,
      fromAccount: transactionData.fromAccount,
      toAccount: transactionData.toAccount,
      currency: transactionData.currency
    });
  }

  /**
   * Log account management actions
   */
  static async logAccountEvent(userId, action, accountData) {
    await this.logEvent('ACCOUNT', userId, action, {
      accountNumber: accountData.accountNumber,
      accountName: accountData.name
    });
  }

  /**
   * Log security events
   */
  static async logSecurityEvent(userId, action, details = {}) {
    await this.logEvent('SECURITY', userId, action, details);
  }

  /**
   * Log admin actions
   */
  static async logAdminEvent(userId, action, details = {}) {
    await this.logEvent('ADMIN', userId, action, details);
  }

  /**
   * Generic event logger
   */
  static async logEvent(category, userId, action, details = {}) {
    try {
      await Log.create({
        user_id: userId,
        action: `${category}:${action}`,
        details: JSON.stringify({
          category,
          timestamp: new Date().toISOString(),
          ...details
        }),
        ip_address: details.ip || 'unknown',
        user_agent: details.userAgent || 'unknown'
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - logging failures shouldn't break the main flow
    }
  }

  /**
   * Get audit logs with filtering and pagination
   */
  static async getAuditLogs(filters = {}, pagination = {}) {
    const { page = 1, limit = 50 } = pagination;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (filters.userId) whereClause.user_id = filters.userId;
    if (filters.action) whereClause.action = { [Op.like]: `%${filters.action}%` };
    if (filters.startDate) {
      whereClause.created_at = {
        [Op.gte]: new Date(filters.startDate)
      };
    }
    if (filters.endDate) {
      whereClause.created_at = {
        ...whereClause.created_at,
        [Op.lte]: new Date(filters.endDate)
      };
    }

    return await Log.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit,
      offset,
      include: [
        {
          model: require('../models').User,
          attributes: ['username', 'email']
        }
      ]
    });
  }
}

module.exports = AuditLogger;
