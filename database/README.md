# Bank API Database Documentation

This document describes the relational database structure for the Bank API application. The database is designed to support banking operations including user management, account tracking, transaction processing, and security.

## Database Schema

### ER Diagram (Text Representation)

```
+------------+       +-------------+       +---------------+
|   users    |       |  accounts   |       | transactions  |
+------------+       +-------------+       +---------------+
| id (PK)    |<---+  | id (PK)     |       | id (PK)       |
| username   |    |  | account_num |<--+   | from_account  |
| password   |    |  | user_id (FK)|   |   | to_account    |
| full_name  |    |  | balance     |   |   | amount        |
| email      |    |  | currency    |   |   | currency      |
| role_id (FK)-+  |  | name        |   |   | explanation   |
| is_active  |  |   | is_active   |   |   | status        |
| created_at |  |   | created_at  |   |   | is_external   |
| updated_at |  |   | updated_at  |   |   | created_at    |
+------------+  |   +-------------+   |   +---------------+
                |                     |
+------------+  |   +-------------+   |   +---------------+
|   roles    |  |   |  sessions   |   |   |     logs      |
+------------+  |   +-------------+   |   +---------------+
| id (PK)    |<-+   | id (PK)     |   |   | id (PK)       |
| name       |      | user_id (FK)----+   | user_id (FK)  |
| description|      | token       |       | action        |
| permissions|      | expires_at  |       | entity_type   |
| created_at |      | ip_address  |       | entity_id     |
| updated_at |      | user_agent  |       | ip_address    |
+------------+      | created_at  |       | details (JSON)|
                    | updated_at  |       | created_at    |
                    +-------------+       +---------------+

                    +-------------+
                    |  settings   |
                    +-------------+
                    | id (PK)     |
                    | name        |
                    | value       |
                    | description |
                    | created_at  |
                    | updated_at  |
                    +-------------+
```

## Tables Description

### 1. users
Stores information about system users (customers, administrators, etc.).
- **id**: Primary key
- **username**: Unique username for login
- **password**: Hashed password
- **full_name**: User's full name
- **email**: User's email address (unique)
- **role_id**: Foreign key to roles table
- **is_active**: Whether the user is active (boolean)
- **created_at**: Timestamp when the user was created
- **updated_at**: Timestamp when the user was last updated

### 2. accounts
Stores bank accounts associated with users.
- **id**: Primary key
- **account_number**: Unique account number with bank prefix
- **user_id**: Foreign key to users table (account owner)
- **balance**: Current account balance
- **currency**: Account currency (EUR, USD, GBP, etc.)
- **name**: Account name/description
- **is_active**: Whether the account is active
- **created_at**: Timestamp when the account was created
- **updated_at**: Timestamp when the account was last updated

### 3. transactions
Stores all financial transactions between accounts.
- **id**: Primary key
- **from_account**: Source account number
- **to_account**: Destination account number
- **amount**: Transaction amount
- **original_amount**: Original amount (for currency conversion)
- **original_currency**: Original currency (for currency conversion)
- **currency**: Transaction currency
- **exchange_rate**: Exchange rate used (for currency conversion)
- **explanation**: Transaction description
- **sender_name**: Name of the sender
- **receiver_name**: Name of the receiver
- **status**: Transaction status (pending, completed, failed, rejected)
- **is_external**: Whether it's an external transaction (boolean)
- **reference_id**: External reference ID
- **created_at**: Timestamp when the transaction was created
- **updated_at**: Timestamp when the transaction was last updated

### 4. roles
Stores user roles and permissions.
- **id**: Primary key
- **name**: Role name (admin, manager, user, etc.)
- **description**: Role description
- **permissions**: JSON object containing role permissions
- **created_at**: Timestamp when the role was created
- **updated_at**: Timestamp when the role was last updated

### 5. sessions
Stores active user sessions.
- **id**: Primary key
- **user_id**: Foreign key to users table
- **token**: Session token (JWT)
- **expires_at**: Timestamp when the session expires
- **ip_address**: IP address used for the session
- **user_agent**: User agent information
- **created_at**: Timestamp when the session was created
- **updated_at**: Timestamp when the session was last updated

### 6. logs
Stores system activity logs.
- **id**: Primary key
- **user_id**: Foreign key to users table (can be NULL for system actions)
- **action**: Action performed (LOGIN, TRANSFER, etc.)
- **entity_type**: Type of entity affected (user, account, transaction)
- **entity_id**: ID of the entity affected
- **ip_address**: IP address from which the action was performed
- **details**: JSON object with additional details
- **created_at**: Timestamp when the log was created

### 7. settings
Stores system settings.
- **id**: Primary key
- **name**: Setting name
- **value**: Setting value
- **description**: Setting description
- **created_at**: Timestamp when the setting was created
- **updated_at**: Timestamp when the setting was last updated

## Database Relationships

1. **Users to Accounts**: One-to-Many (1:N)
   - A user can have multiple accounts
   - An account belongs to exactly one user

2. **Users to Sessions**: One-to-Many (1:N)
   - A user can have multiple active sessions
   - A session belongs to exactly one user

3. **Users to Roles**: Many-to-One (N:1)
   - Many users can have the same role
   - A user has exactly one role

4. **Users to Logs**: One-to-Many (1:N)
   - A user can have multiple log entries
   - A log entry can be associated with one user or none (system actions)

5. **Accounts to Transactions**: Implicit relationship through account_number
   - An account can be involved in multiple transactions
   - A transaction involves exactly two accounts (sender and receiver)

## External Transactions Handling

The database is designed to support both internal and external transactions:

1. For **internal transfers** (between accounts in the same bank):
   - Both `from_account` and `to_account` reference existing accounts in the system
   - The `is_external` flag is set to `false`

2. For **external transfers** (from other banks):
   - The `from_account` field contains an account number from an external bank
   - Only the `to_account` field references an existing local account
   - The `is_external` flag is set to `true`
   - There is no foreign key constraint on the `from_account` field to allow external account numbers

This design enables the system to properly record transactions that originate from other banks while maintaining data integrity for local accounts.

## Stored Procedures

The database includes the following stored procedures for common operations:

1. **create_account**: Creates a new account for a user
2. **execute_internal_transfer**: Executes a money transfer between internal accounts
3. **process_external_transaction**: Processes an incoming external transaction
4. **get_user_total_balance**: Function that calculates a user's total balance in a specific currency

## Security and Access Control

Multiple database users are created with specific permissions:

1. **bank_admin**: Full access to the database
2. **bank_app**: Application user with permissions to perform typical operations
3. **bank_readonly**: Read-only access for reporting
4. **bank_backup**: User for backup operations
5. **bank_audit**: User for security auditing

## Backup and Restore

Backup commands and procedures are available in the `backup.sql` file, including:
- Full database backup
- Schema-only backup
- Data-only backup
- Automatic backup script with retention policy

## Setup Instructions

To set up the database:

1. Install MariaDB server
2. Make the setup script executable: `chmod +x setup.sh`
3. Run the setup script: `./setup.sh`
4. Follow the prompts to create the database structure, stored procedures, and sample data

Alternatively, you can use the npm/bun scripts as defined in package.json:

```bash
# Set up the database structure
bun run db:setup

# Add sample data (optional)
bun run db:sample-data
```

## Manual Database Setup

If you prefer to set up the database without using the setup script, follow these steps:

1. **Create the database structure**:
   ```bash
   mysql -u root -p < create_database.sql
   ```

2. **Create stored procedures**:
   ```bash
   mysql -u root -p < procedures.sql
   ```

3. **Create database users**:
   ```bash
   mysql -u root -p < users.sql
   ```

4. **Set Bank Prefix** (Optional):
   After creating the database, you can update the bank prefix to match your .env file:
   ```sql
   USE bank_api;
   UPDATE settings SET value = 'YOUR_PREFIX' WHERE name = 'bank_prefix';
   ```

5. **Add sample data** (Optional):
   ```bash
   mysql -u root -p < sample_data.sql
   ```

After setup, your application will automatically use the bank prefix from the settings table. If you need to change the prefix later, update the entry in the settings table, and all new account numbers will use the new prefix.

## Bank Prefix Management

The database is designed to handle bank prefix changes automatically:

1. When the bank prefix is updated in the `settings` table, a trigger (`after_update_bank_prefix`) automatically:
   - Updates all existing account numbers in the system
   - Replaces the old prefix with the new one
   - Logs the change to the `logs` table

This ensures that when you change your bank prefix in the `.env` file, all account numbers are updated automatically to reflect this change.

### Runtime Changes

The application includes a file monitoring system that:

1. Periodically checks for changes to the `.env` file (once per minute)
2. When a change to `BANK_PREFIX` is detected:
   - Reloads the environment variables
   - Updates the database setting
   - The database trigger automatically updates all existing account numbers
   
This means you can modify the bank prefix in your `.env` file while the application is running,
and all account numbers will be updated automatically without requiring a restart.

### How It Works

If you update the `BANK_PREFIX` in your `.env` file:

1. Within 1 minute, the application detects the changed file
2. It reloads the environment variables and updates the setting in the database
3. The database trigger fires and updates all account numbers
4. A log entry is created documenting the change

This allows for seamless bank prefix changes without manual database updates or application restarts.