-- Database Backup and Restore Commands for Bank API
-- Note: These commands should be run from the command line, not directly in MariaDB client

-- -----------------------------------------------------------------------------
-- BACKUP COMMANDS
-- -----------------------------------------------------------------------------

-- Full database backup
-- mysqldump -u bank_backup -p bank_api > bank_api_backup_YYYYMMDD.sql

-- Schema-only backup (no data)
-- mysqldump -u bank_backup -p --no-data bank_api > bank_api_schema_YYYYMMDD.sql

-- Data-only backup
-- mysqldump -u bank_backup -p --no-create-info bank_api > bank_api_data_YYYYMMDD.sql

-- Backup specific tables
-- mysqldump -u bank_backup -p bank_api users accounts > bank_api_users_accounts_YYYYMMDD.sql

-- Compressed backup to save space
-- mysqldump -u bank_backup -p bank_api | gzip > bank_api_backup_YYYYMMDD.sql.gz

-- Backup with transaction data for consistency
-- mysqldump -u bank_backup -p --single-transaction bank_api > bank_api_backup_YYYYMMDD.sql

-- -----------------------------------------------------------------------------
-- RESTORE COMMANDS
-- -----------------------------------------------------------------------------

-- Restore full database
-- mysql -u bank_admin -p bank_api < bank_api_backup_YYYYMMDD.sql

-- Restore from compressed backup
-- gunzip < bank_api_backup_YYYYMMDD.sql.gz | mysql -u bank_admin -p bank_api

-- -----------------------------------------------------------------------------
-- SCHEDULED BACKUP SCRIPT (save as backup.sh)
-- -----------------------------------------------------------------------------

/*
#!/bin/bash
# Automated backup script for bank_api database

# Configuration
BACKUP_DIR="/var/backups/mariadb/bank_api"
MYSQL_USER="bank_backup"
MYSQL_PASSWORD="backup_secure_password"
DATABASE="bank_api"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/bank_api_backup_$DATE.sql.gz"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create backup
mysqldump --user=$MYSQL_USER --password=$MYSQL_PASSWORD \
  --single-transaction --quick --lock-tables=false \
  $DATABASE | gzip > $BACKUP_FILE

# Check if backup was successful
if [ $? -eq 0 ]; then
  echo "Database backup completed successfully: $BACKUP_FILE"
else
  echo "Error: Database backup failed"
  exit 1
fi

# Remove backups older than RETENTION_DAYS
find $BACKUP_DIR -name "bank_api_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# Example cron job (add to /etc/crontab):
# 0 1 * * * root /path/to/backup.sh > /var/log/bank_api_backup.log 2>&1
*/

-- -----------------------------------------------------------------------------
-- DATA EXPORT FOR REPORTING
-- -----------------------------------------------------------------------------

-- Export transactions to CSV (run from command line)
-- mysql -u bank_readonly -p -e "SELECT id, from_account, to_account, amount, currency, explanation, status, created_at FROM bank_api.transactions WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)" --batch | sed 's/\t/,/g' > transactions_report.csv

-- Export user balances to CSV (run from command line)
-- mysql -u bank_readonly -p -e "SELECT u.id, u.username, u.full_name, a.account_number, a.balance, a.currency FROM bank_api.users u JOIN bank_api.accounts a ON u.id = a.user_id" --batch | sed 's/\t/,/g' > user_balances_report.csv 