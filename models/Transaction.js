const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  from_account: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  to_account: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  original_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true
  },
  original_currency: {
    type: DataTypes.STRING(3),
    allowNull: true
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false
  },
  exchange_rate: {
    type: DataTypes.DECIMAL(15, 6),
    allowNull: true,
    defaultValue: 1.000000
  },
  explanation: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  sender_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  receiver_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'rejected'),
    allowNull: false,
    defaultValue: 'pending'
  },
  is_external: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  reference_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  tableName: 'transactions',
  timestamps: true
});

module.exports = Transaction;