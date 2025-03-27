const { Setting, sequelize } = require('../models');

/**
 * Database synchronization utilities
 */
class DatabaseSync {
  /**
   * Synchronize bank prefix between .env and database
   * @returns {Promise<boolean>} True if prefix was updated, false otherwise
   */
  static async syncBankPrefix() {
    try {
      // Get current bank prefix from .env
      const envBankPrefix = process.env.BANK_PREFIX;
      
      if (!envBankPrefix) {
        console.log('BANK_PREFIX not found in .env file');
        return false;
      }
      
      // Get bank prefix from database settings
      const prefixSetting = await Setting.findOne({
        where: { name: 'bank_prefix' }
      });
      
      if (!prefixSetting) {
        // If no prefix setting exists, create one
        console.log('Creating new bank_prefix setting in database');
        await Setting.create({
          name: 'bank_prefix',
          value: envBankPrefix,
          description: 'Bank prefix for account numbers'
        });
        return true;
      } else if (prefixSetting.value !== envBankPrefix) {
        // Update existing prefix if it doesn't match
        console.log(`Updating bank prefix in database from ${prefixSetting.value} to ${envBankPrefix}`);
        const oldPrefix = prefixSetting.value;
        
        // Use raw SQL query to avoid timestamp issues
        await sequelize.query(
          'UPDATE settings SET value = ? WHERE id = ?',
          {
            replacements: [envBankPrefix, prefixSetting.id],
            type: sequelize.QueryTypes.UPDATE
          }
        );
        
        // The trigger in the database will handle updating all account numbers
        console.log(`All accounts with prefix ${oldPrefix} have been updated to ${envBankPrefix}`);
        console.log(`This change was applied automatically by the database trigger 'after_update_bank_prefix'`);
        
        return true;
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
