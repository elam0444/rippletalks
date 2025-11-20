# RippleTalk Backend API

Express.js + TypeScript + Supabase backend for internal dashboard with secure shareable links (DocSend-style).

## Features

- **Companies Module**: Multi-tenant company management
- **Secure Shareable Links**: DocSend-style magic links for VIP guests
- **Supabase Auth**: JWT-based authentication for staff/hosts
- **Row Level Security**: Multi-tenant data isolation
- **View Analytics**: Track link opens with IP, user-agent, and timestamps

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a [.env](.env) file with your Supabase credentials:

```env
PORT=3000
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to find these values:**
- Go to your Supabase project dashboard
- Navigate to **Settings** → **API**
- Copy **URL**, **anon public** key, and **service_role** key

**Security Warning:** Never commit the `SUPABASE_SERVICE_ROLE_KEY` to version control!

### 3. Set Up Database

Run the SQL schemas in your Supabase project:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of [src/database/schema.sql](src/database/schema.sql)
4. Execute the SQL
5. Copy and paste the contents of [src/database/rls-policies.sql](src/database/rls-policies.sql)
6. Execute the SQL

This will create:
- **Tables:**
  - `users` - User accounts with email unique index
  - `companies` - Company/organization data with companyId index
  - `documents` - Document metadata and storage references
  - `share_links` - Shareable link records with linkId index
  - `share_link_logs` - Tracking logs for link opens/views
  - `activity_logs` - Audit trail for all system activities
- **Views:**
  - `share_link_stats` - Aggregated view statistics
  - `document_analytics` - Document-level analytics
- **Row Level Security (RLS):** Multi-tenant security policies

### 4. Run the Server

Development mode (with hot reload):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## API Endpoints

### Authentication

Most endpoints require authentication via JWT token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

**How to get a JWT token:**
1. Create a user in Supabase Dashboard (Authentication → Users)
2. Use Supabase Auth SDK to login from frontend
3. Use the `access_token` from the session

---

## Companies Module

### GET /companies
Get all companies owned by the authenticated user.

**Authentication:** Required

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Acme Corp",
      "logo_url": "https://example.com/logo.png",
      "owner_user_id": "user-uuid",
      "created_at": "2024-11-18T10:00:00Z",
      "updated_at": "2024-11-18T10:00:00Z"
    }
  ],
  "count": 1
}
```

### POST /companies
Create a new company.

**Authentication:** Required

**Request:**
```json
{
  "name": "Acme Corp",
  "logo_url": "https://example.com/logo.png" // optional
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "logo_url": "https://example.com/logo.png",
    "owner_user_id": "user-uuid",
    "created_at": "2024-11-18T10:00:00Z",
    "updated_at": "2024-11-18T10:00:00Z"
  },
  "message": "Company created successfully"
}
```

**Error Responses:**
- `400` - Name is required
- `401` - Not authenticated

### GET /companies/:id
Get a specific company by ID.

**Authentication:** Required (must be owner)

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "logo_url": "https://example.com/logo.png",
    "owner_user_id": "user-uuid",
    "created_at": "2024-11-18T10:00:00Z",
    "updated_at": "2024-11-18T10:00:00Z"
  }
}
```

**Error Responses:**
- `404` - Company not found or access denied
- `401` - Not authenticated

### PATCH /companies/:id
Update a company.

**Authentication:** Required (must be owner)

**Request:**
```json
{
  "name": "New Company Name", // optional
  "logo_url": "https://example.com/new-logo.png" // optional
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "New Company Name",
    "logo_url": "https://example.com/new-logo.png",
    "owner_user_id": "user-uuid",
    "created_at": "2024-11-18T10:00:00Z",
    "updated_at": "2024-11-18T11:00:00Z"
  },
  "message": "Company updated successfully"
}
```

### DELETE /companies/:id
Delete a company.

**Authentication:** Required (must be owner)

**Response:**
```json
{
  "message": "Company deleted successfully"
}
```

---

## Secure Shareable Links Module

### POST /links
Generate a new shareable link.

**Authentication:** Required

**Request:**
```json
{
  "documentId": "uuid-of-document",
  "expiresAt": "2024-12-31T23:59:59Z" // optional
}
```

**Response:**
```json
{
  "linkId": "abc123xyz456",
  "documentId": "uuid-of-document",
  "expiresAt": "2024-12-31T23:59:59Z",
  "createdBy": "user-uuid",
  "createdAt": "2024-11-18T10:00:00Z"
}
```

**Error Responses:**
- `400` - documentId is required
- `401` - Not authenticated

### GET /links/:linkId
Retrieve document information by link ID (public access).

**Authentication:** Not required (VIP guests can access)

**Response:**
```json
{
  "documentId": "uuid-of-document",
  "linkId": "abc123xyz456",
  "expiresAt": "2024-12-31T23:59:59Z",
  "createdAt": "2024-11-18T10:00:00Z"
}
```

**Error Responses:**
- `404` - Link not found
- `410` - Link has expired

### POST /links/:linkId/log
Track an open/view event (public access).

**Authentication:** Not required

**Request:**
```json
{
  "ipAddress": "127.0.0.1", // optional, auto-detected if not provided
  "userAgent": "Mozilla/5.0..." // optional, auto-detected if not provided
}
```

**Response:**
```json
{
  "logged": true,
  "timestamp": "2024-11-18T10:30:00Z"
}
```

**Auto-Detection:**
- IP address extracted from `req.ip` or `x-forwarded-for` header
- User agent extracted from `user-agent` header

### GET /links/:linkId/stats
Get view statistics for a link.

**Authentication:** Not required (currently public)

**Response:**
```json
{
  "linkId": "abc123xyz456",
  "documentId": "uuid-of-document",
  "viewCount": 42,
  "lastOpened": "2024-11-18T10:30:00Z",
  "expiresAt": "2024-12-31T23:59:59Z",
  "createdAt": "2024-11-18T10:00:00Z"
}
```

---

## Utility Endpoints

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-11-18T10:00:00Z"
}
```

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── supabase.ts           # Supabase client configuration
│   ├── controllers/
│   │   ├── companyController.ts  # Company endpoints logic
│   │   └── linkController.ts     # Share link endpoints logic
│   ├── database/
│   │   ├── schema.sql            # Database schema DDL
│   │   └── rls-policies.sql      # Row Level Security policies
│   ├── middleware/
│   │   └── auth.ts               # JWT authentication middleware
│   ├── routes/
│   │   ├── companyRoutes.ts      # Company API routes
│   │   └── linkRoutes.ts         # Share link API routes
│   ├── services/
│   │   └── companyService.ts     # Company data access layer
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   └── index.ts                  # Express app entry point
├── .env                          # Environment variables (not in git)
├── .gitignore                    # Git ignore rules
├── ARCHITECTURE.md               # Architecture documentation
├── SECURITY.md                   # Security best practices guide
├── README.md                     # This file
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies and scripts
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

## Database Schema

### users
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | TEXT | Email (unique index) |
| password_hash | TEXT | Hashed password |
| first_name | TEXT | First name |
| last_name | TEXT | Last name |
| company_id | UUID | Reference to companies |
| role | TEXT | User role: admin, user, viewer |
| is_active | BOOLEAN | Account status |
| email_verified | BOOLEAN | Email verification status |
| last_login | TIMESTAMP | Last login timestamp |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### companies
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Company name |
| logo_url | TEXT | Company logo URL (optional) |
| owner_user_id | UUID | Owner's Supabase Auth user ID |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### documents
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| title | TEXT | Document title |
| description | TEXT | Document description |
| file_url | TEXT | Storage URL for file |
| file_type | TEXT | File type (pdf, docx, etc.) |
| file_size | INTEGER | File size in bytes |
| owner_id | UUID | Reference to users (owner) |
| company_id | UUID | Reference to companies |
| folder_path | TEXT | Folder path |
| tags | TEXT[] | Document tags |
| is_public | BOOLEAN | Public visibility flag |
| version | INTEGER | Document version |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### share_links
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| document_id | UUID | Reference to documents |
| link_id | TEXT | Unique shareable identifier (index) |
| created_by | UUID | Reference to users (creator) |
| expires_at | TIMESTAMP | Optional expiration date |
| password_hash | TEXT | Optional password protection |
| allow_download | BOOLEAN | Download permission flag |
| require_email | BOOLEAN | Email collection requirement |
| max_views | INTEGER | Maximum view count |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### share_link_logs
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| link_id | TEXT | Reference to share_links (index) |
| timestamp | TIMESTAMP | Access timestamp |
| ip_address | TEXT | Visitor's IP address |
| user_agent | TEXT | Visitor's user agent |
| location | JSONB | Geolocation data |
| viewer_email | TEXT | Viewer email (if required) |
| session_duration | INTEGER | Session duration in seconds |

### activity_logs
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to users |
| company_id | UUID | Reference to companies |
| action | TEXT | Action type (e.g., 'document.created') |
| resource_type | TEXT | Resource type (document, link, user) |
| resource_id | UUID | Resource identifier |
| metadata | JSONB | Additional metadata |
| ip_address | TEXT | IP address |
| user_agent | TEXT | User agent |
| created_at | TIMESTAMP | Creation timestamp |

## Security Features

- **Supabase Auth Integration:** JWT-based authentication for staff/hosts
- **Row Level Security (RLS):** Multi-tenant data isolation
- **Ownership Validation:** Users can only access their own companies
- **Link Expiration:** Time-based link validity
- **Secure Link Generation:** Cryptographically secure random IDs (nanoid)
- **IP and User-Agent Tracking:** Comprehensive access logging
- **Input Validation:** Request validation and sanitization
- **Service Role Key Protection:** Admin operations bypass RLS securely
- **Error Handling:** Generic error messages, detailed server-side logging

**See [SECURITY.md](SECURITY.md) for comprehensive security documentation.**

## Best Practices Implemented

### Link ID Validation
```typescript
// Cryptographically secure link IDs
const linkId = nanoid(12); // "V1StGXR8_Z5j"
```

### Link Expiration Checks
```typescript
if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
  return res.status(410).json({ error: 'Share link has expired' });
}
```

### IP and User-Agent Logging
```typescript
// Auto-detect from request headers
const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
const clientUserAgent = req.headers['user-agent'] || 'unknown';
```

### Ownership Validation
```typescript
// Service layer enforces ownership
const company = await getCompanyById(companyId, req.user.id);
```

### Supabase Auth Integration

**Frontend (React/Next.js example):**
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

const token = data.session.access_token;

// Use token in API requests
fetch('http://localhost:3000/companies', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Backend validates JWT:**
```typescript
// Middleware automatically validates token
const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
req.user = { id: user.id, email: user.email };
```

## Performance Optimization

### Database Indexes
- `users`: email (unique), company_id
- `companies`: owner_user_id
- `documents`: owner_id, company_id, created_at
- `share_links`: link_id (unique), document_id, created_by
- `share_link_logs`: link_id, timestamp
- `activity_logs`: user_id, company_id, action, created_at

### Supabase Views
- `share_link_stats`: Aggregated view statistics
- `document_analytics`: Document-level analytics

## Testing the API

### 1. Create a Test User in Supabase

Go to Supabase Dashboard → Authentication → Users → Add user

### 2. Get JWT Token

Use Supabase Auth SDK in frontend or test with:

```bash
curl -X POST 'https://xxx.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 3. Test Companies Endpoints

```bash
# Create a company
curl -X POST http://localhost:3000/companies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "logo_url": "https://example.com/logo.png"}'

# Get all companies
curl http://localhost:3000/companies \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Test Share Links

```bash
# Create a share link (requires auth)
curl -X POST http://localhost:3000/links \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"documentId": "some-uuid", "expiresAt": "2025-12-31T23:59:59Z"}'

# View a link (public - no auth needed)
curl http://localhost:3000/links/abc123xyz456

# Log a view (public)
curl -X POST http://localhost:3000/links/abc123xyz456/log \
  -H "Content-Type: application/json" \
  -d '{}'

# Get stats
curl http://localhost:3000/links/abc123xyz456/stats
```

## Additional Resources

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Detailed architecture and design patterns
- **[SECURITY.md](SECURITY.md)** - Comprehensive security guide
- **[Supabase Docs](https://supabase.com/docs)** - Official Supabase documentation
- **[Express.js Docs](https://expressjs.com/)** - Express.js documentation

## Support & Contribution

For issues, questions, or contributions, please refer to the project repository.
