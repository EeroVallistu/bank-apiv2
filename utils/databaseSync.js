const { Setting, sequelize } = require('../models');

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
        console.log('Bank prefix not found in central bank');
        return false;
      }
      console.log(`Current bank prefix from central bank: ${cbBankPrefix}`);
      // Get bank prefix from database settings
      let prefixSetting;
      try {
        prefixSetting = await Setting.findOne({
          where: { name: 'bank_prefix' }
        });
      } catch (findError) {
        console.error('Error finding bank_prefix in database:', findError);
        return false;
      }
      if (!prefixSetting) {
        // If no prefix setting exists, create one using direct SQL
        console.log('Creating new bank_prefix setting in database');
        try {
          await sequelize.query(
            `INSERT INTO settings (name, value, description, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())`,
            {
              replacements: ['bank_prefix', cbBankPrefix, 'Bank prefix for account numbers'],
              type: sequelize.QueryTypes.INSERT
            }
          );
          console.log(`Successfully created bank_prefix setting with value: ${cbBankPrefix}`);
          return true;
        } catch (insertError) {
          console.error('Error creating bank_prefix setting:', insertError);
          return false;
        }
      } else if (prefixSetting.value !== cbBankPrefix) {
        // Update existing prefix if it doesn't match
        console.log(`Updating bank prefix in database from '${prefixSetting.value}' to '${cbBankPrefix}'`);
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
          console.log('SQL update result:', result);
          console.log(`All accounts with prefix ${oldPrefix} should be updated to ${cbBankPrefix}`);
          console.log(`This change should be applied automatically by the database trigger 'after_update_bank_prefix'`);
          // Verify the update
          const verifyResult = await sequelize.query(
            `SELECT value FROM settings WHERE name = 'bank_prefix'`,
            {
              type: sequelize.QueryTypes.SELECT
            }
          );
          console.log('Verification result:', verifyResult);
          if (verifyResult.length > 0) {
            console.log(`Current bank_prefix in database: ${verifyResult[0].value}`);
          }
          return true;
        } catch (updateError) {
          console.error('Error updating bank_prefix setting:', updateError);
          return false;
        }
      } else {
        console.log(`Bank prefix already up to date in database: ${prefixSetting.value}`);
      }
      return false;
    } catch (error) {
      console.error('Error synchronizing bank prefix:', error);
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
      console.error('Error getting database bank prefix:', error);
      return null;
    }
  }
}

module.exports = DatabaseSync;
