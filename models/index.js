const { sequelize, testConnection } = require('./database');
const { Op } = require('sequelize');
const User = require('./User');
const Role = require('./Role');
const Account = require('./Account');
const Transaction = require('./Transaction');
const Session = require('./Session');
const Log = require('./Log');
const Setting = require('./Setting');

// Define model associations
User.belongsTo(Role, { foreignKey: 'role_id' });
Role.hasMany(User, { foreignKey: 'role_id' });

User.hasMany(Account, { foreignKey: 'user_id' });
Account.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Session, { foreignKey: 'user_id' });
Session.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Log, { foreignKey: 'user_id' });
Log.belongsTo(User, { foreignKey: 'user_id' });

// Define custom methods that mimic the in-memory store
const findUserById = async (id) => User.findByPk(id);
const findUserByUsername = async (username) => User.findOne({ where: { username } });
const findUserByEmail = async (email) => User.findOne({ where: { email } });
const findAccountById = async (id) => Account.findByPk(id);
const findAccountByNumber = async (accountNumber) => Account.findOne({ where: { account_number: accountNumber } });
const findAccountsByUserId = async (userId) => Account.findAll({ where: { user_id: userId } });
const findTransactionById = async (id) => Transaction.findByPk(id);
const findTransactionsByAccountNumber = async (accountNumber) => {
  return Transaction.findAll({
    where: {
      [Op.or]: [
        { from_account: accountNumber },
        { to_account: accountNumber }
      ]
    }
  });
};

// Helper to generate account numbers with bank prefix
const generateAccountNumber = async () => {
  // Always get the prefix from the central bank
  const centralBankService = require('../services/centralBankService');
  const prefix = (await centralBankService.getOurBankPrefix()) || '000';
  const randomPart = Math.random().toString(36).substring(2, 12);
  return `${prefix}${randomPart}`;
};

module.exports = {
  sequelize,
  testConnection,
  User,
  Role,
  Account,
  Transaction,
  Session,
  Log,
  Setting,
  findUserById,
  findUserByUsername,
  findUserByEmail,
  findAccountById,
  findAccountByNumber,
  findAccountsByUserId,
  findTransactionById,
  findTransactionsByAccountNumber,
  generateAccountNumber
};