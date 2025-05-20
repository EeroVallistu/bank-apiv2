# Database Integration Guide

This guide explains how to set up and use the MariaDB database with the Bank API.

## Setup

### Prerequisites

1. MariaDB server installed and running
2. Node.js and npm installed
3. Bank API code downloaded

### Creating the Database

1. Run the database setup script:
   ```
   npm run db:setup
   ```
   This will:
   - Create the database schema
   - Set up stored procedures
   - Create database users with appropriate permissions

2. Load sample data (optional):
   ```
   npm run db:sample-data
   ```

3. Initialize Sequelize models:
   ```
   npm run db:init
   ```

## Environment Configuration

Make sure your `.env` file contains these database settings:

```
# Database connection settings
USE_DATABASE=true
DB_HOST=localhost
DB_PORT=3306
DB_NAME=bank_api
DB_USER=bank_app
DB_PASSWORD=app_secure_password
DB_DIALECT=mariadb

## Database Models

The API uses Sequelize ORM to interact with the database. The following models are available:

- `User`: User accounts
- `Role`: User roles and permissions
- `Account`: Bank accounts
- `Transaction`: Money transfers
- `Session`: User sessions
- `Log`: System logs
- `Setting`: System settings

## Model Relationships

The following relationships are defined between models:

1. User-Role: Many-to-One (N:1)
   ```javascript
   User.belongsTo(Role, { foreignKey: 'role_id' });
   Role.hasMany(User, { foreignKey: 'role_id' });
   ```

2. User-Account: One-to-Many (1:N)
   ```javascript
   User.hasMany(Account, { foreignKey: 'user_id' });
   Account.belongsTo(User, { foreignKey: 'user_id' });
   ```

3. User-Session: One-to-Many (1:N)
   ```javascript
   User.hasMany(Session, { foreignKey: 'user_id' });
   Session.belongsTo(User, { foreignKey: 'user_id' });
   ```

4. User-Log: One-to-Many (1:N)
   ```javascript
   User.hasMany(Log, { foreignKey: 'user_id' });
   Log.belongsTo(User, { foreignKey: 'user_id' });
   ```

## Helper Functions

The API provides several helper functions to interact with the database:

- `findUserById(id)`: Find a user by ID
- `findUserByUsername(username)`: Find a user by username
- `findUserByEmail(email)`: Find a user by email
- `findAccountById(id)`: Find an account by ID
- `findAccountByNumber(accountNumber)`: Find an account by account number
- `findAccountsByUserId(userId)`: Find all accounts for a user
- `findTransactionById(id)`: Find a transaction by ID
- `findTransactionsByAccountNumber(accountNumber)`: Find all transactions for an account
- `generateAccountNumber()`: Generate a new account number

## Transaction Example

Here's an example of how to use transactions to ensure data consistency:

```javascript
const { sequelize, Account, Transaction } = require('../models');

async function transferMoney(fromAccount, toAccount, amount) {
  const transaction = await sequelize.transaction();
  
  try {
    // Deduct from source account
    await Account.update(
      { balance: sequelize.literal(`balance - ${amount}`) },
      { 
        where: { account_number: fromAccount },
        transaction
      }
    );
    
    // Add to destination account
    await Account.update(
      { balance: sequelize.literal(`balance + ${amount}`) },
      { 
        where: { account_number: toAccount },
        transaction
      }
    );
    
    // Create transaction record
    const transactionRecord = await Transaction.create({
      from_account: fromAccount,
      to_account: toAccount,
      amount,
      currency: 'EUR',
      explanation: 'Transfer',
      status: 'completed',
      is_external: false
    }, { transaction });
    
    // Commit the transaction
    await transaction.commit();
    return transactionRecord;
    
  } catch (error) {
    // If any operation fails, roll back the transaction
    await transaction.rollback();
    throw error;
  }
}
```

## Stored Procedures

You can also call the database's stored procedures using Sequelize:

```javascript
const [results] = await sequelize.query(
  'CALL execute_internal_transfer(:fromAccount, :toAccount, :amount, :explanation, :userId)',
  {
    replacements: {
      fromAccount: 'cc612345a8b9cdef0123',
      toAccount: 'cc6111222333444555a',
      amount: 100.00,
      explanation: 'Test transfer',
      userId: 1
    },
    type: sequelize.QueryTypes.RAW
  }
);
```

## Backup and Restore

For database backup and restore operations, use the commands in `database/backup.sql`. 