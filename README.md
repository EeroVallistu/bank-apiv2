# Bank API v2

## Overview

Bank API v2 is a modern banking API system that provides secure account management, transaction processing, and inter-bank communication capabilities. This project implements a complete banking backend with support for multiple currencies, role-based access control, and B2B transaction processing.

## Features

- **User Management**: Account creation, authentication, and role-based permissions
- **Account Operations**: Create accounts, check balances, manage account status
- **Transaction Processing**: Internal and external money transfers with proper validation
- **Multi-Currency Support**: Handle multiple currencies with automatic conversion
- **Interbank Connectivity**: Process transactions between different banks using JWT
- **Security**: JWT authentication, permission-based access control, and comprehensive logging
- **Performance**: Response caching and database optimization

## Technology Stack

- **Runtime**: Bun.js for JavaScript execution
- **Database**: MariaDB for data storage
- **Authentication**: JWT-based with role permissions
- **API Format**: RESTful API with JSON responses

## Getting Started

### Prerequisites

- Bun.js v1.0 or higher
- MariaDB 10.5 or higher
- Node.js v16 or higher (for supporting tools)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/EeroVallistu/bank-apiv2.git
   cd bank-apiv2
   ```

2. Install dependencies:
   ```
   bun install
   ```

3. Set up the configuration:
   ```
   cp .env.example .env
   ```
   Edit the `.env` file with your database and API settings.

4. Set up the database:
   ```
   # Run the database creation script
   mysql -u root -p < database/create_database.sql
   # Create stored procedures
   mysql -u root -p < database/procedures.sql
   # Set up database users
   mysql -u root -p < database/users.sql
   ```

### Running the Application

- Development mode:
  ```
  bun run dev
  ```

- Production mode:
  ```
  bun run start
  ```

## API Documentation

API endpoints are documented in the OpenAPI format. You can view the documentation by opening `openapi.yaml` in a compatible viewer.

### Key Endpoints

- `/auth` - Authentication and user management
- `/accounts` - Account operations
- `/transactions` - Transaction processing
- `/b2b` - Business-to-business operations
- `/currency` - Currency exchange rates and conversion

## Documentation

Additional documentation is available in the `docs/` directory:

- [Database Structure](docs/database.md)
- [Permission System](docs/permissions.md)

## License

This project is proprietary software. All rights reserved.