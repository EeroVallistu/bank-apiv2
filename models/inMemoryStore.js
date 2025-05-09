/**
 * In-memory data store for the Bank API
 * This module provides arrays to store data in memory instead of using a database
 */

// User data store
const users = [];

// Account data store
const accounts = [];

// Transaction data store
const transactions = [];

// Helper functions for working with the in-memory store
const findUserById = (id) => users.find(user => user.id === id);
const findUserByUsername = (username) => users.find(user => user.username === username);
const findUserByEmail = (email) => users.find(user => user.email === email);
const findAccountById = (id) => accounts.find(account => account.id === id);
const findAccountByNumber = (accountNumber) => accounts.find(account => account.accountNumber === accountNumber);
const findAccountsByUserId = (userId) => accounts.filter(account => account.userId === userId);
const findTransactionById = (id) => transactions.find(transaction => transaction.id === id);
const findTransactionsByAccountNumber = (accountNumber) => 
  transactions.filter(transaction => 
    transaction.fromAccount === accountNumber || transaction.toAccount === accountNumber
  );

// Generate unique IDs
let nextUserId = 1;
let nextAccountId = 1;
let nextTransactionId = 1;

const generateUserId = () => nextUserId++;
const generateAccountId = () => nextAccountId++;
const generateTransactionId = () => nextTransactionId++;

// Helper to generate account numbers with bank prefix
const generateAccountNumber = () => {
  // Get bank prefix directly from environment variable
  const bankPrefix = process.env.BANK_PREFIX;
  
  // Make sure we only use the first 3 characters for the bank prefix
  // This ensures consistency when prefix changes
  const prefix = bankPrefix.substring(0, 3);
  const randomPart = Math.random().toString(36).substring(2, 12);
  return `${prefix}${randomPart}`;
};

module.exports = {
  users,
  accounts,
  transactions,
  findUserById,
  findUserByUsername,
  findUserByEmail,
  findAccountById,
  findAccountByNumber,
  findAccountsByUserId,
  findTransactionById,
  findTransactionsByAccountNumber,
  generateUserId,
  generateAccountId,
  generateTransactionId,
  generateAccountNumber
};
