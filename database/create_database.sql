-- Banking Application Database Schema
-- Create database
CREATE DATABASE IF NOT EXISTS bank_api CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE bank_api;

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    permissions JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Will store hashed passwords
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    account_number VARCHAR(50) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_account_number (account_number)
) ENGINE=InnoDB;

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_account VARCHAR(50) NOT NULL,
    to_account VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    original_amount DECIMAL(15, 2),
    original_currency VARCHAR(3),
    currency VARCHAR(3) NOT NULL,
    exchange_rate DECIMAL(15, 6) DEFAULT 1.000000,
    explanation VARCHAR(255) NOT NULL,
    sender_name VARCHAR(100),
    receiver_name VARCHAR(100),
    status ENUM('pending', 'completed', 'failed', 'rejected') NOT NULL DEFAULT 'pending',
    is_external BOOLEAN DEFAULT FALSE,
    reference_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (to_account) REFERENCES accounts(account_number) ON UPDATE CASCADE,
    INDEX idx_from_account (from_account),
    INDEX idx_to_account (to_account),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- Create logs table
CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(50),
    ip_address VARCHAR(45),
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Populate roles table with default roles
INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Administrator with full access', '{"accounts": ["read", "write", "create", "delete"], "users": ["read", "write", "create", "delete"], "transactions": ["read", "write", "create"]}'),
('manager', 'Bank manager with elevated permissions', '{"accounts": ["read", "write", "create"], "users": ["read", "write"], "transactions": ["read", "write", "create"]}'),
('user', 'Regular bank user', '{"accounts": ["read"], "users": ["read"], "transactions": ["read", "create"]}');

-- Populate settings table with default settings
INSERT INTO settings (name, value, description) VALUES
('bank_name', 'Eero Bank', 'Name of the bank'),
('bank_prefix', '000', 'Bank prefix for account numbers'),
('transaction_fee', '0.50', 'Fee for each transaction in the default currency'),
('maintenance_mode', 'false', 'Whether the system is in maintenance mode');

-- Add trigger to update existing account numbers when bank prefix changes
DELIMITER //
CREATE TRIGGER after_update_bank_prefix
AFTER UPDATE ON settings
FOR EACH ROW
BEGIN
    DECLARE old_prefix VARCHAR(3);
    DECLARE new_prefix VARCHAR(3);
    
    -- Only proceed if this is the bank_prefix setting being updated
    IF NEW.name = 'bank_prefix' AND OLD.value != NEW.value THEN
        SET old_prefix = OLD.value;
        SET new_prefix = NEW.value;
        
        -- Update all existing account numbers with the new prefix
        UPDATE accounts 
        SET account_number = CONCAT(new_prefix, SUBSTRING(account_number, LENGTH(old_prefix) + 1))
        WHERE account_number LIKE CONCAT(old_prefix, '%');
        
        -- Log the prefix change
        INSERT INTO logs (
            user_id,
            action,
            entity_type,
            entity_id,
            details
        ) VALUES (
            NULL, -- System action
            'BANK_PREFIX_CHANGED',
            'settings',
            NEW.id,
            JSON_OBJECT(
                'old_prefix', old_prefix,
                'new_prefix', new_prefix
            )
        );
    END IF;
END //
DELIMITER ;