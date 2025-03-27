const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const Account = sequelize.define('Account', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  account_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  balance: {
    type: DataTypes.DECIMAL(15, 2), // Ensure we're using DECIMAL(15,2) for currency
    allowNull: false,
    defaultValue: 0.00,
    get() {
      // Always return as float to avoid string issues
      const value = this.getDataValue('balance');
      return value === null ? null : parseFloat(value);
    },
    set(value) {
      // Always store as formatted decimal to avoid corruption
      if (value !== null) {
        this.setDataValue('balance', parseFloat(parseFloat(value).toFixed(2)));
      } else {
        this.setDataValue('balance', null);
      }
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'accounts',
  timestamps: true
});

module.exports = Account;