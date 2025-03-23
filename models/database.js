const { Sequelize } = require('sequelize');
const config = require('../config/database');

// Determine the environment
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Ensure dialect is explicitly set
if (!dbConfig.dialect) {
  dbConfig.dialect = 'mysql'; // Set default dialect
}

// Create Sequelize instance
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect, // Explicit dialect is required
    logging: dbConfig.logging,
    define: dbConfig.define,
    pool: dbConfig.pool,
    dialectOptions: dbConfig.dialectOptions
  }
);

// Test the connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
}

module.exports = { sequelize, testConnection }; 