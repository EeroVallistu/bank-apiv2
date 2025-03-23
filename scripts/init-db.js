require('dotenv').config();
const { sequelize, testConnection } = require('../models/database');
const models = require('../models');

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
    
    process.exit(0);
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeDatabase(); 