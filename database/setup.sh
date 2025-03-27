#!/bin/bash

# Bank API Database Setup Script

# Configuration
DB_NAME="bank_api"
DB_ROOT_USER="root"
DB_APP_USER="bank_app"
DB_APP_PASSWORD="app_secure_password"
DB_FILES_DIR="$(dirname "$0")"

# Load environment variables from .env
ENV_FILE="../.env"
if [ -f "$ENV_FILE" ]; then
  echo "Loading environment variables from .env file..."
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# Set default bank prefix if not defined in .env
BANK_PREFIX=${BANK_PREFIX:-"000"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if MariaDB is installed
check_mariadb() {
  if ! command -v mysql &> /dev/null; then
    echo -e "${RED}Error: MariaDB is not installed.${NC}"
    echo "Please install MariaDB before running this script."
    echo "For example:"
    echo "  sudo apt update"
    echo "  sudo apt install mariadb-server"
    exit 1
  fi
}

# Function to execute SQL files with error handling
execute_sql_file() {
  local file="$1"
  local description="$2"
  
  echo -e "${YELLOW}Executing $description...${NC}"
  
  # Replace bank prefix placeholder with actual value
  sed "s/\${BANK_PREFIX}/$BANK_PREFIX/g" "$file" > "$file.tmp"
  
  if mysql -u "$DB_ROOT_USER" -p < "$file.tmp"; then
    echo -e "${GREEN}✓ Successfully executed $description${NC}"
    rm -f "$file.tmp"
    return 0
  else
    echo -e "${RED}✗ Failed to execute $description${NC}"
    rm -f "$file.tmp"
    return 1
  fi
}

# Main function
main() {
  echo "===================================================="
  echo "      Bank API Database Setup Script"
  echo "===================================================="
  
  # Check if MariaDB is installed
  check_mariadb
  
  echo "This script will set up the Bank API database structure."
  echo "You will need the MariaDB root password to proceed."
  echo -e "${YELLOW}Warning: This will create a new database if it doesn't exist.${NC}"
  echo
  echo -e "Using bank prefix: ${GREEN}$BANK_PREFIX${NC} (from .env file)"
  echo
  
  read -p "Do you want to continue? (y/n): " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Setup cancelled."
    exit 0
  fi
  
  # Create database structure
  echo "Setting up database schema..."
  if ! execute_sql_file "$DB_FILES_DIR/create_database.sql" "database schema creation"; then
    echo -e "${RED}Database schema creation failed. Exiting.${NC}"
    exit 1
  fi
  
  # Create stored procedures
  echo "Setting up stored procedures..."
  if ! execute_sql_file "$DB_FILES_DIR/procedures.sql" "stored procedures creation"; then
    echo -e "${RED}Stored procedures creation failed. Exiting.${NC}"
    exit 1
  fi
  
  # Create users and permissions
  echo "Setting up database users and permissions..."
  if ! execute_sql_file "$DB_FILES_DIR/users.sql" "users and permissions setup"; then
    echo -e "${RED}Users and permissions setup failed. Exiting.${NC}"
    exit 1
  fi
  
  # Ask if sample data should be inserted
  read -p "Do you want to insert sample data for testing? (y/n): " insert_sample
  if [[ "$insert_sample" == "y" || "$insert_sample" == "Y" ]]; then
    echo "Inserting sample data..."
    if ! execute_sql_file "$DB_FILES_DIR/sample_data.sql" "sample data insertion"; then
      echo -e "${RED}Sample data insertion failed.${NC}"
    fi
  fi
  
  echo -e "${GREEN}Bank API database setup completed!${NC}"
  echo
  echo "You can now use the following connection details in your .env file:"
  echo "DB_NAME=$DB_NAME"
  echo "DB_USER=$DB_APP_USER"
  echo "DB_PASSWORD=$DB_APP_PASSWORD"
  echo
  echo "To back up your database, use the commands in backup.sql"
}

# Execute main function
main