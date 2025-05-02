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
  // Prioritize the environment variable over database setting
  if (process.env.BANK_PREFIX) {
    const prefix = process.env.BANK_PREFIX.substring(0, 3);
    const randomPart = Math.random().toString(36).substring(2, 12);
    
    // Also update the database to keep it in sync (but don't wait for it)
    const bankPrefix = await Setting.findOne({ where: { name: 'bank_prefix' } });
    if (bankPrefix && bankPrefix.value !== prefix) {
      console.log(`Updating bank_prefix in database from ${bankPrefix.value} to ${prefix}`);
      Setting.update({ value: prefix }, { where: { name: 'bank_prefix' } })
        .catch(err => console.error('Failed to update bank prefix in database:', err));
    } else if (!bankPrefix) {
      console.log(`Creating bank_prefix setting in database with value ${prefix}`);
      Setting.create({
        name: 'bank_prefix',
        value: prefix,
        description: 'Bank prefix for account numbers'
      }).catch(err => console.error('Failed to create bank prefix setting in database:', err));
    }
    
    return `${prefix}${randomPart}`;
  }
  
  // Fallback to database only if environment variable is not set
  const bankPrefix = await Setting.findOne({ where: { name: 'bank_prefix' } });
  const prefix = bankPrefix ? bankPrefix.value.substring(0, 3) : '000';
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