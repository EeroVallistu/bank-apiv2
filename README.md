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
- **Performance**: Redis caching and database optimization for high-speed operations
- **Caching**: Distributed Redis caching with automatic fallback to memory cache
- **Monitoring**: Health checks, performance metrics, and detailed logging

## Technology Stack

- **Runtime**: Bun.js for JavaScript execution
- **Database**: MariaDB for data storage
- **Cache**: Redis for distributed caching with memory fallback
- **Authentication**: JWT-based with role permissions
- **API Format**: RESTful API with JSON responses
- **Monitoring**: Winston logging with file rotation and health endpoints

## Getting Started

### Prerequisites

- Bun.js v1.0 or higher
- MariaDB 10.5 or higher
- Redis 6.0 or higher (for caching)
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

3. Set up Redis (using Docker - recommended):
   ```
   docker run -d --name redis -p 6379:6379 redis:alpine
   ```

4. Set up the configuration:
   ```
   cp .env.example .env
   ```
   Edit the `.env` file with your database, Redis, and API settings.

5. Set up the database:
   ```
   # Run the database creation script
   mysql -u root -p < database/create_database.sql
   # Create stored procedures
   mysql -u root -p < database/procedures.sql
   # Set up database users
   mysql -u root -p < database/users.sql
   ```

### Environment Configuration

The application requires several environment variables to be configured in your `.env` file:

#### Required Settings
```bash
# JWT and Security
JWT_SECRET=your-secure-random-string
BANK_NAME=Your Bank Name
API_KEY=your-central-bank-api-key

# Database Connection
USE_DATABASE=true
DB_HOST=localhost
DB_PORT=3306
DB_NAME=bank_api
DB_USER=root
DB_PASSWORD=your-password
DB_DIALECT=mysql

# Redis Cache Settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=                    # Leave empty if no password
REDIS_DB=0                         # Redis database number (0-15)
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

- Run tests:
  ```
  bun run test
  ```

## Caching System

The application implements a hybrid caching system with Redis:

### Features
- **Distributed Caching**: Uses Redis for shared cache across multiple instances
- **Automatic Fallback**: Falls back to memory cache if Redis is unavailable
- **TTL Support**: Configurable time-to-live for cached items
- **Health Monitoring**: Redis health checks included in application monitoring

### Cache Usage
The cache is used for:
- Currency exchange rates (5 minutes TTL)
- User account data (configurable TTL)
- API response caching (middleware level)
- Database settings and configuration

```

## API Documentation

API endpoints are documented in the OpenAPI format. You can view the documentation by opening `openapi.yaml` in a compatible viewer.

### Key Endpoints

- `/auth` - Authentication and user management
- `/accounts` - Account operations
- `/transactions` - Transaction processing
- `/b2b` - Business-to-business operations
- `/currency` - Currency exchange rates and conversion

## Performance & Monitoring

### Logging
- **Winston Logger**: Structured logging with multiple levels
- **File Rotation**: Automatic log file rotation and archiving
- **Security Logs**: Separate logging for security-related events
- **Performance Metrics**: Request timing and cache hit/miss rates

### Caching Performance
- **Redis Primary**: High-performance distributed caching
- **Memory Fallback**: Automatic fallback for high availability
- **Cache Headers**: HTTP cache headers for client-side optimization
- **TTL Management**: Intelligent cache expiration strategies

## Documentation

Additional documentation is available in the `docs/` directory:

- [Database Structure](docs/database.md)
- [Permission System](docs/permissions.md)

## Troubleshooting

### Redis Connection Issues
If Redis is not connecting:
1. Verify Redis is running: `docker ps` (if using Docker)
2. Check Redis connectivity: `telnet localhost 6379`
3. Verify environment variables in `.env`
4. Check application logs for Redis connection errors

### Database Issues
If database connection fails:
1. Verify MariaDB is running and accessible
2. Check database credentials in `.env`
3. Ensure database and tables exist
4. Check database user permissions

### Performance Issues
For performance optimization:
1. Monitor cache hit rates via `/health/cache`
2. Check Redis memory usage and optimization
3. Review database query performance
4. Monitor application logs for bottlenecks

## Development

### Running Tests
```bash
# Run all tests
bun run test

# Run specific test suite
bun run test auth
bun run test accounts
bun run test transactions
```

### Project Structure
```
config/           # Configuration files (database, Redis)
middleware/       # Express middleware (auth, cache, validation)
models/          # Database models and schemas
routes/          # API route handlers
services/        # Business logic services
utils/           # Utility functions and helpers
tests/           # Test suites
docs/            # Documentation
```

## License

This project is proprietary software. All rights reserved.