require('dotenv').config();
const { sequelize, testConnection, Setting } = require('../models');
const models = require('../models');

/**
 * Update bank prefix in database to match .env file
 */
async function updateBankPrefix() {
  try {
    // Get current bank prefix from central bank
    const centralBankService = require('../services/centralBankService');
    const cbBankPrefix = await centralBankService.getOurBankPrefix();
    if (!cbBankPrefix) {
      console.log('Bank prefix not found in central bank, skipping update');
      return;
    }
    console.log(`Found bank prefix in central bank: ${cbBankPrefix}`);
    // Get bank prefix from database settings
    const prefixSetting = await Setting.findOne({
      where: { name: 'bank_prefix' }
    });
    if (!prefixSetting) {
      // If no prefix setting exists, create one
      console.log('No bank_prefix found in database, creating new setting');
      await Setting.create({
        name: 'bank_prefix',
        value: cbBankPrefix,
        description: 'Bank prefix for account numbers'
      });
      console.log(`Bank prefix set to: ${cbBankPrefix}`);
    } else if (prefixSetting.value !== cbBankPrefix) {
      // Update existing prefix if it doesn't match
      console.log(`Updating bank prefix in database from ${prefixSetting.value} to ${cbBankPrefix}`);
      prefixSetting.value = cbBankPrefix;
      await prefixSetting.save();
      console.log('Bank prefix updated successfully');
    } else {
      console.log('Bank prefix in database already matches central bank');
    }
  } catch (error) {
    console.error('Error updating bank prefix:', error);
  }
}

async function initializeDatabase() {
  try {
    console.log('Testing database connection...');
    const connected = await testConnection();
    
    if (!connected) {
      console.error('Failed to connect to database. Exiting.');
      process.exit(1);
    }
    
    console.log('Syncing database models...');
    // In production, use migrations instead
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Database sync complete');
    
    // Update bank prefix in database to match .env file
    await updateBankPrefix();
    
    process.exit(0);
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeDatabase();