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
  timestamps: false, // No timestamps in the model
  updatedAt: 'updated_at', // But do track updated_at
  createdAt: false // No created_at field
});

module.exports = Setting;