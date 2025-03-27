require('dotenv').config();
const { sequelize, testConnection, Setting } = require('../models');
const models = require('../models');

/**
 * Update bank prefix in database to match .env file
 */
async function updateBankPrefix() {
  try {
    // Get current bank prefix from .env
    const envBankPrefix = process.env.BANK_PREFIX;
    
    if (!envBankPrefix) {
      console.log('BANK_PREFIX not found in .env file, skipping update');
      return;
    }
    
    console.log(`Found bank prefix in .env: ${envBankPrefix}`);
    
    // Get bank prefix from database settings
    const prefixSetting = await Setting.findOne({
      where: { name: 'bank_prefix' }
    });
    
    if (!prefixSetting) {
      // If no prefix setting exists, create one
      console.log('No bank_prefix found in database, creating new setting');
      await Setting.create({
        name: 'bank_prefix',
        value: envBankPrefix,
        description: 'Bank prefix for account numbers'
      });
      console.log(`Bank prefix set to: ${envBankPrefix}`);
    } else if (prefixSetting.value !== envBankPrefix) {
      // Update existing prefix if it doesn't match
      console.log(`Updating bank prefix in database from ${prefixSetting.value} to ${envBankPrefix}`);
      prefixSetting.value = envBankPrefix;
      await prefixSetting.save();
      console.log('Bank prefix updated successfully');
    } else {
      console.log('Bank prefix in database already matches .env file');
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