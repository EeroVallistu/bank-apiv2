const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const Setting = sequelize.define('Setting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'settings',
  timestamps: false,  // Completely disable Sequelize's timestamp handling
  createdAt: false,   // Explicitly disable createdAt
  updatedAt: false    // Explicitly disable updatedAt
});

module.exports = Setting;