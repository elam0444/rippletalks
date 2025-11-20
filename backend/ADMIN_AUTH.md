# Admin Authentication & Management API

This document describes the backend authentication and admin management endpoints for RippleTalk.

## Authentication Routes (`/auth`)

### POST `/auth/admin/login`
Admin login endpoint that validates credentials and returns a session token.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "role": "admin",
    "companyId": "company-uuid"
  },
  "session": {
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token",
    "expiresAt": 1234567890
  }
}
```

**Error Responses:**
- `400` - Missing email or password
- `401` - Invalid credentials
- `403` - User is not an admin

---

### POST `/auth/refresh`
Refresh an expired access token using a refresh token.

**Request:**
```json
{
  "refreshToken": "refresh-token"
}
```

**Response:**
```json
{
  "session": {
    "accessToken": "new-jwt-token",
    "refreshToken": "new-refresh-token",
    "expiresAt": 1234567890
  }
}
```

---

### POST `/auth/logout`
Logout and invalidate the current session.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

---

### GET `/auth/profile`
Get the current authenticated user's profile.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "role": "admin",
    "company_id": "company-uuid",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

## Admin Routes (`/admin`)

All admin routes require:
1. Authentication (Bearer token in Authorization header)
2. Admin role verification

### User Management

#### GET `/admin/users`
Get all users in the admin's company.

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "role": "user",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

#### POST `/admin/users`
Create a new user in the admin's company.

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "securepassword",
  "role": "user"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "newuser@example.com",
    "role": "user",
    "companyId": "company-uuid"
  }
}
```

**Error Responses:**
- `400` - Missing email or password
- `500` - Failed to create user

---

#### PATCH `/admin/users/:userId/role`
Update a user's role.

**Request:**
```json
{
  "role": "admin"
}
```

**Response:**
```json
{
  "message": "User role updated successfully"
}
```

**Error Responses:**
- `400` - Invalid role (must be 'admin' or 'user')
- `403` - Cannot modify users from other companies
- `404` - User not found

---

#### DELETE `/admin/users/:userId`
Delete a user from the company.

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

**Error Responses:**
- `400` - Cannot delete your own account
- `403` - Cannot delete users from other companies
- `404` - User not found

---

### Dashboard Analytics

#### GET `/admin/dashboard/stats`
Get dashboard statistics for the admin's company.

**Response:**
```json
{
  "stats": {
    "totalUsers": 10,
    "totalDocuments": 50,
    "totalShareLinks": 25,
    "totalViews": 1000
  }
}
```

---

#### GET `/admin/dashboard/activity`
Get recent activity logs for the company.

**Query Parameters:**
- `limit` (optional, default: 50) - Number of logs to return
- `offset` (optional, default: 0) - Offset for pagination

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "company_id": "uuid",
      "action": "document_created",
      "details": {},
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## Middleware

### `authenticateUser`
Validates JWT token and attaches user data to request.

**Location:** [src/middleware/auth.ts](src/middleware/auth.ts)

### `requireAdmin`
Requires authentication and verifies user has admin role.

**Location:** [src/middleware/auth.ts](src/middleware/auth.ts)

### `optionalAuth`
Optionally attaches user data if token is present, but doesn't fail if missing.

**Location:** [src/middleware/auth.ts](src/middleware/auth.ts)

---

## Security Features

1. **JWT Token Validation**: All protected endpoints validate JWT tokens via Supabase Auth
2. **Role-Based Access Control**: Admin endpoints verify user role before allowing access
3. **Company Isolation**: Admins can only manage users within their own company
4. **Self-Deletion Prevention**: Admins cannot delete their own accounts
5. **Transaction Rollback**: User creation rolls back auth user if database insert fails

---

## Example Usage

### Login Flow
```bash
# 1. Login as admin
curl -X POST http://localhost:3000/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Response includes accessToken

# 2. Use token for authenticated requests
curl http://localhost:3000/admin/users \
  -H "Authorization: Bearer <access-token>"
```

### Create User Flow
```bash
curl -X POST http://localhost:3000/admin/users \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "securepassword",
    "role": "user"
  }'
```

### Get Dashboard Stats
```bash
curl http://localhost:3000/admin/dashboard/stats \
  -H "Authorization: Bearer <access-token>"
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": "Additional details (optional)"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error
