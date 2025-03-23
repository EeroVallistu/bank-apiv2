#!/bin/bash

# Bank API - Update .env for MariaDB connection
# This script updates the .env file to use MariaDB instead of in-memory data

# Configuration
ENV_FILE="../.env"
ENV_EXAMPLE="../.env.example"
APP_DIR=$(dirname "$(dirname "$(readlink -f "$0")")")
ENV_PATH="$APP_DIR/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to ask for database credentials
ask_credentials() {
  echo -e "${YELLOW}Please provide your MariaDB database credentials:${NC}"
  
  read -p "Database Host [localhost]: " DB_HOST
  DB_HOST=${DB_HOST:-localhost}
  
  read -p "Database Port [3306]: " DB_PORT
  DB_PORT=${DB_PORT:-3306}
  
  read -p "Database Name [bank_api]: " DB_NAME
  DB_NAME=${DB_NAME:-bank_api}
  
  read -p "Database User [bank_app]: " DB_USER
  DB_USER=${DB_USER:-bank_app}
  
  read -p "Database Password [app_secure_password]: " DB_PASSWORD
  DB_PASSWORD=${DB_PASSWORD:-app_secure_password}
}

# Function to update environment file
update_env_file() {
  if [ ! -f "$ENV_PATH" ]; then
    echo -e "${RED}Error: .env file not found at $ENV_PATH${NC}"
    if [ -f "$ENV_EXAMPLE" ]; then
      echo "Creating .env from .env.example..."
      cp "$ENV_EXAMPLE" "$ENV_PATH"
    else
      echo "Creating new .env file..."
      touch "$ENV_PATH"
    fi
  fi
  
  echo -e "${YELLOW}Updating .env file with database connection details...${NC}"
  
  # Check if DB_* settings already exist and update them
  if grep -q "DB_HOST" "$ENV_PATH"; then
    # Update existing settings
    sed -i "s/DB_HOST=.*/DB_HOST=$DB_HOST/" "$ENV_PATH"
    sed -i "s/DB_PORT=.*/DB_PORT=$DB_PORT/" "$ENV_PATH"
    sed -i "s/DB_NAME=.*/DB_NAME=$DB_NAME/" "$ENV_PATH"
    sed -i "s/DB_USER=.*/DB_USER=$DB_USER/" "$ENV_PATH"
    sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" "$ENV_PATH"
  else
    # Add new settings
    echo "" >> "$ENV_PATH"
    echo "# Database connection settings" >> "$ENV_PATH"
    echo "DB_HOST=$DB_HOST" >> "$ENV_PATH"
    echo "DB_PORT=$DB_PORT" >> "$ENV_PATH"
    echo "DB_NAME=$DB_NAME" >> "$ENV_PATH"
    echo "DB_USER=$DB_USER" >> "$ENV_PATH"
    echo "DB_PASSWORD=$DB_PASSWORD" >> "$ENV_PATH"
    echo "DB_DIALECT=mariadb" >> "$ENV_PATH"
  fi
  
  # Make sure USE_DATABASE=true is set
  if grep -q "USE_DATABASE" "$ENV_PATH"; then
    sed -i "s/USE_DATABASE=.*/USE_DATABASE=true/" "$ENV_PATH"
  else
    echo "USE_DATABASE=true" >> "$ENV_PATH"
  fi
  
  echo -e "${GREEN}Successfully updated .env file with database settings!${NC}"
}

# Main function
main() {
  echo "===================================================="
  echo "      Bank API - Update .env for MariaDB"
  echo "===================================================="
  
  echo "This script will update your .env file to use MariaDB instead of in-memory data."
  echo "The existing .env file will be modified to include database connection settings."
  echo
  
  read -p "Do you want to continue? (y/n): " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Update cancelled."
    exit 0
  fi
  
  ask_credentials
  update_env_file
  
  echo
  echo -e "${GREEN}Configuration complete!${NC}"
  echo "Your application is now configured to use MariaDB."
  echo "Please make sure to restart your application for changes to take effect."
  echo
  echo "If you haven't set up the database yet, run the database setup script:"
  echo "  cd database"
  echo "  ./setup.sh"
}

# Execute main function
main 