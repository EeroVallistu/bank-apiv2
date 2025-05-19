# Bank API Permission System

## Overview

The Bank API implements a role-based access control (RBAC) system. Each user is assigned a role, and each role has a set of permissions that define what actions the user can perform on different resources.

## Roles

The system has three predefined roles:

1. **admin** - Administrator with full access to all resources
2. **manager** - Bank manager with elevated permissions
3. **user** - Regular bank user with limited permissions

## Resources and Actions

Permissions are defined as a combination of resources and actions:

| Resource | Available Actions |
|----------|-------------------|
| accounts | read, write, create, delete |
| users | read, write, create, delete |
| transactions | read, write, create |

## Permission Format

Permissions are stored in the database as a JSON object where:
- Keys are resources
- Values are arrays of allowed actions

Example:
```json
{
  "accounts": ["read", "create"],
  "users": ["read"],
  "transactions": ["read", "create"]
}
```

## Error Responses

When a user attempts to perform an action they don't have permission for, the API returns a 403 Forbidden error with a standard error message:

```json
{
  "error": "Permission denied"
}
```

This follows the application's standard error format, keeping responses consistent across the API.

## Default Role Permissions

### Admin
```json
{
  "accounts": ["read", "write", "create", "delete"],
  "users": ["read", "write", "create", "delete"],
  "transactions": ["read", "write", "create"]
}
```

### Manager
```json
{
  "accounts": ["read", "write", "create"],
  "users": ["read", "write"],
  "transactions": ["read", "write", "create"]
}
```

### User
```json
{
  "accounts": ["read", "create"],
  "users": ["read"],
  "transactions": ["read", "create"]
}
```