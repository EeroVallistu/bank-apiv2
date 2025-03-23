USE bank_api;

-- Create database users with appropriate permissions

-- Admin user with full access
CREATE USER IF NOT EXISTS 'bank_admin'@'localhost' IDENTIFIED BY 'admin_secure_password';
GRANT ALL PRIVILEGES ON bank_api.* TO 'bank_admin'@'localhost';

-- Application user - used by the API service
CREATE USER IF NOT EXISTS 'bank_app'@'localhost' IDENTIFIED BY 'app_secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_api.* TO 'bank_app'@'localhost';
GRANT EXECUTE ON PROCEDURE bank_api.create_account TO 'bank_app'@'localhost';
GRANT EXECUTE ON PROCEDURE bank_api.execute_internal_transfer TO 'bank_app'@'localhost';
GRANT EXECUTE ON PROCEDURE bank_api.process_external_transaction TO 'bank_app'@'localhost';
GRANT EXECUTE ON FUNCTION bank_api.get_user_total_balance TO 'bank_app'@'localhost';

-- Read-only user - for reporting and monitoring
CREATE USER IF NOT EXISTS 'bank_readonly'@'localhost' IDENTIFIED BY 'readonly_secure_password';
GRANT SELECT ON bank_api.* TO 'bank_readonly'@'localhost';

-- Backup user - for database backups
CREATE USER IF NOT EXISTS 'bank_backup'@'localhost' IDENTIFIED BY 'backup_secure_password';
GRANT SELECT, LOCK TABLES, SHOW VIEW ON bank_api.* TO 'bank_backup'@'localhost';

-- Audit user - for security auditing
CREATE USER IF NOT EXISTS 'bank_audit'@'localhost' IDENTIFIED BY 'audit_secure_password';
GRANT SELECT ON bank_api.logs TO 'bank_audit'@'localhost';
GRANT SELECT ON bank_api.transactions TO 'bank_audit'@'localhost';
GRANT SELECT (id, username, full_name, email, role_id, is_active, created_at, updated_at) ON bank_api.users TO 'bank_audit'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Important notes:
-- 1. In a production environment, use more secure passwords
-- 2. Consider restricting access to specific IP addresses
-- 3. Review and update permissions regularly
-- 4. Implement password rotation policies 