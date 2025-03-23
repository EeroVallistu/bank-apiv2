const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  permissions: {
    type: DataTypes.JSON,
    allowNull: false
  }
}, {
  tableName: 'roles',
  timestamps: true
});

module.exports = Role; 