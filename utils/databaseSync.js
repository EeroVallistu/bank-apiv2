const { Setting, sequelize } = require('../models');
const { logger } = require('./logger');

/**
 * Database synchronization utilities
 */
class DatabaseSync {
  /**
   * Synchronize bank prefix between central bank and database
   * @returns {Promise<boolean>} True if prefix was updated, false otherwise
   */
  static async syncBankPrefix() {
    try {
      // Get current bank prefix from central bank
      const centralBankService = require('../services/centralBankService');
      const cbBankPrefix = await centralBankService.getOurBankPrefix();
      if (!cbBankPrefix) {
        logger.info('Bank prefix not found in central bank');
        return false;
      }
      logger.info(`Current bank prefix from central bank: ${cbBankPrefix}`);
      // Get bank prefix from database settings
      let prefixSetting;
      try {
        prefixSetting = await Setting.findOne({
          where: { name: 'bank_prefix' }
        });
      } catch (findError) {
        logger.error('Error finding bank_prefix in database:', { error: findError.message, stack: findError.stack });
        return false;
      }
      if (!prefixSetting) {
        // If no prefix setting exists, create one using direct SQL
        logger.info('Creating new bank_prefix setting in database');
        try {
          await sequelize.query(
            `INSERT INTO settings (name, value, description, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
            {
              replacements: ['bank_prefix', cbBankPrefix, 'Bank prefix for account numbers'],
              type: sequelize.QueryTypes.INSERT
            }
          );
          logger.info(`Successfully created bank_prefix setting with value: ${cbBankPrefix}`);
          return true;
        } catch (insertError) {
          logger.error('Error creating bank_prefix setting:', { error: insertError.message, stack: insertError.stack });
          return false;
        }
      } else if (prefixSetting.value !== cbBankPrefix) {
        // Update existing prefix if it doesn't match
        logger.info(`Updating bank prefix in database from '${prefixSetting.value}' to '${cbBankPrefix}'`);
        const oldPrefix = prefixSetting.value;
        try {
          // Use direct SQL with explicit debugging
          const result = await sequelize.query(
            `UPDATE settings SET value = ?, updated_at = NOW() WHERE name = ?`,
            {
              replacements: [cbBankPrefix, 'bank_prefix'],
              type: sequelize.QueryTypes.UPDATE
            }
          );
          logger.info('SQL update result:', { result });
          logger.info(`All accounts with prefix ${oldPrefix} should be updated to ${cbBankPrefix}`);
          logger.info(`This change should be applied automatically by the database trigger 'after_update_bank_prefix'`);
          // Verify the update
          const verifyResult = await sequelize.query(
            `SELECT value FROM settings WHERE name = 'bank_prefix'`,
            {
              type: sequelize.QueryTypes.SELECT
            }
          );
          logger.info('Verification result:', { verifyResult });
          if (verifyResult.length > 0) {
            logger.info(`Current bank_prefix in database: ${verifyResult[0].value}`);
          }
          return true;
        } catch (updateError) {
          logger.error('Error updating bank_prefix setting:', { error: updateError.message, stack: updateError.stack });
          return false;
        }
      } else {
        logger.info(`Bank prefix already up to date in database: ${prefixSetting.value}`);
      }
      return false;
    } catch (error) {
      logger.error('Error synchronizing bank prefix:', { error: error.message, stack: error.stack });
      return false;
    }
  }

  /**
   * Get the current bank prefix from database
   * @returns {Promise<string|null>} The bank prefix or null if not found
   */
  static async getCurrentDatabasePrefix() {
    try {
      const prefixSetting = await Setting.findOne({
        where: { name: 'bank_prefix' }
      });
      
      return prefixSetting ? prefixSetting.value : null;
    } catch (error) {
      logger.error('Error getting database bank prefix:', { error: error.message, stack: error.stack });
      return null;
    }
  }
}

module.exports = DatabaseSync;
