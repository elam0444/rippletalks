# Security Guide

## Overview

This document outlines security best practices and implementation details for the RippleTalk backend API.

## Authentication Architecture

### Supabase Auth Integration

The backend uses **Supabase Auth** for user authentication:

1. **User Registration/Login** happens on the frontend via Supabase Auth SDK
2. **JWT Token** is issued by Supabase Auth upon successful login
3. **Backend validates** JWT tokens on protected endpoints
4. **User context** is extracted from validated tokens

### How Authentication Works

#### 1. Frontend Login (Supabase Auth SDK)
```javascript
// Frontend code (example)
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// JWT token is in: data.session.access_token
```

#### 2. Backend Token Validation
```typescript
// Backend middleware validates token
const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
```

#### 3. Protected Request Flow
```
Client Request
    ↓
Header: Authorization: Bearer <jwt_token>
    ↓
Authentication Middleware (validates JWT)
    ↓
req.user = { id, email, role }
    ↓
Controller (accesses req.user)
    ↓
Service (uses req.user.id for queries)
    ↓
Response
```

## Security Best Practices

### 1. Environment Variables

**Required Variables:**
```env
PORT=3000
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Security Rules:**
- ✅ Store in `.env` file (gitignored)
- ✅ Use different keys for dev/staging/production
- ✅ Rotate keys periodically
- ❌ Never commit to version control
- ❌ Never expose SERVICE_ROLE_KEY to frontend
- ❌ Never log sensitive keys

### 2. Supabase Service Role Key

**What is it?**
- Admin-level API key that bypasses Row Level Security
- Has full read/write access to your entire database
- Used for privileged backend operations

**When to use:**
- ✅ Validating JWT tokens
- ✅ Creating records with `created_by` fields
- ✅ Admin operations that bypass RLS
- ❌ Never send to client
- ❌ Never use in client-side code
- ❌ Never log or expose in error messages

**Protection:**
```typescript
// ✅ GOOD: Server-side only
import { supabaseAdmin } from '../config/supabase';

// ❌ BAD: Exposing in API response
res.json({ serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY });

// ❌ BAD: Logging
console.log('Key:', process.env.SUPABASE_SERVICE_ROLE_KEY);
```

### 3. Link ID Security

**Generation:**
```typescript
import { nanoid } from 'nanoid';

const linkId = nanoid(12); // "V1StGXR8_Z5j"
```

**Security Properties:**
- 12 characters = ~4.6 billion unique combinations
- URL-safe characters (A-Za-z0-9_-)
- Cryptographically random (secure)
- No sequential patterns

**Best Practices:**
- ✅ Use `nanoid` or `uuid` for link IDs
- ✅ Validate linkId format on input
- ❌ Don't use sequential IDs (1, 2, 3...)
- ❌ Don't use predictable patterns
- ❌ Don't include user IDs in link

**Link Expiration:**
```typescript
// Check if link has expired
if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
  return res.status(410).json({ error: 'Share link has expired' });
}
```

### 4. Input Validation

**Required Field Validation:**
```typescript
if (!name || name.trim().length === 0) {
  return res.status(400).json({
    error: 'Validation failed',
    details: 'Company name is required'
  });
}
```

**Best Practices:**
- ✅ Validate all required fields
- ✅ Trim whitespace from user input
- ✅ Validate data types
- ✅ Sanitize HTML if accepting rich text
- ❌ Don't trust client-side validation alone
- ❌ Don't expose internal validation logic

### 5. Authorization & Ownership

**Ownership Validation Pattern:**
```typescript
// Service layer enforces ownership
export const getCompanyById = async (
  companyId: string,
  ownerUserId: string // Requires owner ID
): Promise<Company | null> => {
  const { data, error } = await supabaseAdmin
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .eq('owner_user_id', ownerUserId) // Ownership check
    .single();

  return data;
};
```

**Key Principle:**
- Every user operation validates ownership
- Prevents users from accessing other users' data
- Enforce at service layer (not just controller)

### 6. Error Handling

**Secure Error Responses:**
```typescript
// ✅ GOOD: Generic error
res.status(500).json({
  error: 'Failed to create company'
});

// ❌ BAD: Exposing internal details
res.status(500).json({
  error: 'Database connection failed',
  details: error.stack,
  query: 'SELECT * FROM companies WHERE...'
});
```

**Logging vs Response:**
```typescript
try {
  // ... operation
} catch (error) {
  // ✅ Log detailed error server-side
  console.error('Error in createCompany:', error);

  // ✅ Return generic message to client
  res.status(500).json({
    error: 'Failed to create company',
    details: error instanceof Error ? error.message : 'Unknown error'
  });
}
```

### 7. Rate Limiting

**Recommended Implementation:**
```typescript
import rateLimit from 'express-rate-limit';

// Public endpoints (link viewing)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later'
});

app.use('/links', publicLimiter);

// Authenticated endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Higher limit for authenticated users
});

app.use('/companies', authLimiter);
```

**Why Rate Limiting:**
- Prevents brute force attacks
- Protects against DoS attacks
- Limits abuse of public endpoints
- Reduces server load

### 8. CORS Configuration

**Production CORS Setup:**
```typescript
import cors from 'cors';

// Development (allow all)
app.use(cors());

// Production (restrict origins)
app.use(cors({
  origin: [
    'https://yourdomain.com',
    'https://app.yourdomain.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 9. IP Address & User Agent Logging

**Secure IP Extraction:**
```typescript
const forwardedFor = req.headers['x-forwarded-for'];
const clientIp = ipAddress ||
                 req.ip ||
                 (typeof forwardedFor === 'string' ? forwardedFor : forwardedFor?.[0]) ||
                 'unknown';
```

**Privacy Considerations:**
- IP addresses are personal data (GDPR/CCPA)
- Hash or anonymize IPs if not needed for security
- Document IP logging in privacy policy
- Allow users to request deletion

**User Agent Storage:**
```typescript
const clientUserAgent = userAgent || req.headers['user-agent'] || 'unknown';
```

### 10. SQL Injection Prevention

**Supabase Protection:**
Supabase JS client uses parameterized queries automatically:

```typescript
// ✅ SAFE: Parameterized query
const { data } = await supabase
  .from('companies')
  .select('*')
  .eq('id', userId);

// ❌ UNSAFE: Raw SQL with string concatenation
const { data } = await supabase.rpc('raw_query', {
  query: `SELECT * FROM companies WHERE id = '${userId}'`
});
```

**Best Practices:**
- ✅ Use Supabase client methods (`.select()`, `.insert()`, etc.)
- ✅ Use parameterized queries for raw SQL
- ❌ Never concatenate user input into SQL strings

## Supabase Auth Setup

### 1. Enable Email/Password Auth

In Supabase Dashboard:
1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Configure email templates (optional)
4. Enable email confirmations (recommended)

### 2. Create Users

**Via Supabase Dashboard:**
- Go to **Authentication** → **Users**
- Click **Invite user** or **Add user**

**Via Frontend SDK:**
```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password-123'
});
```

### 3. Getting JWT Tokens

**Frontend Login:**
```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

const token = data.session.access_token;
```

**Making Authenticated Requests:**
```javascript
fetch('http://localhost:3000/companies', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

## Row Level Security (RLS)

### What is RLS?

Row Level Security (RLS) is PostgreSQL's built-in feature that restricts which rows users can access in database queries.

### Companies Table RLS Policy

```sql
-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own companies
CREATE POLICY "Users can view own companies"
  ON companies
  FOR SELECT
  USING (auth.uid() = owner_user_id);

-- Policy: Users can only insert companies they own
CREATE POLICY "Users can insert own companies"
  ON companies
  FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

-- Policy: Users can only update their own companies
CREATE POLICY "Users can update own companies"
  ON companies
  FOR UPDATE
  USING (auth.uid() = owner_user_id);

-- Policy: Users can only delete their own companies
CREATE POLICY "Users can delete own companies"
  ON companies
  FOR DELETE
  USING (auth.uid() = owner_user_id);
```

### Share Links RLS Policy

```sql
-- Enable RLS
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read links (public access)
CREATE POLICY "Public read access"
  ON share_links
  FOR SELECT
  USING (true);

-- Policy: Only authenticated users can create links
CREATE POLICY "Authenticated users can create links"
  ON share_links
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Policy: Users can only update their own links
CREATE POLICY "Users can update own links"
  ON share_links
  FOR UPDATE
  USING (auth.uid() = created_by);
```

### Share Link Logs RLS Policy

```sql
-- Enable RLS
ALTER TABLE share_link_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert logs (public logging)
CREATE POLICY "Public insert access"
  ON share_link_logs
  FOR INSERT
  WITH CHECK (true);

-- Policy: Only link creators can view logs
CREATE POLICY "Link creators can view logs"
  ON share_link_logs
  FOR SELECT
  USING (
    link_id IN (
      SELECT link_id FROM share_links WHERE created_by = auth.uid()
    )
  );
```

### Why Use Both RLS and Backend Auth?

1. **Defense in Depth**: Multiple layers of security
2. **RLS**: Protects against SQL injection and direct DB access
3. **Backend Auth**: Provides application-level control
4. **Service Role**: Bypasses RLS for admin operations

## Security Checklist

### Before Deployment

- [ ] All sensitive keys in `.env` file
- [ ] `.env` added to `.gitignore`
- [ ] CORS configured for production origins
- [ ] Rate limiting enabled
- [ ] RLS policies applied to all tables
- [ ] Input validation on all endpoints
- [ ] Error messages don't expose internals
- [ ] HTTPS enabled (use reverse proxy)
- [ ] Database backups configured
- [ ] Monitoring and logging set up

### Regular Security Maintenance

- [ ] Rotate API keys quarterly
- [ ] Review access logs weekly
- [ ] Update dependencies monthly
- [ ] Audit RLS policies quarterly
- [ ] Review user permissions
- [ ] Test authentication flows
- [ ] Check for security vulnerabilities

## Common Security Pitfalls

### ❌ Don't: Expose Service Role Key
```typescript
// BAD!
res.json({ key: process.env.SUPABASE_SERVICE_ROLE_KEY });
```

### ❌ Don't: Trust Client Data
```typescript
// BAD!
const userId = req.body.userId; // Client can forge this

// GOOD!
const userId = req.user.id; // From validated JWT
```

### ❌ Don't: Skip Ownership Checks
```typescript
// BAD!
const company = await getCompanyById(companyId);

// GOOD!
const company = await getCompanyById(companyId, req.user.id);
```

### ❌ Don't: Return Detailed Errors
```typescript
// BAD!
res.status(500).json({ error: error.stack });

// GOOD!
console.error(error);
res.status(500).json({ error: 'Internal server error' });
```

## Incident Response

### If Service Role Key is Compromised

1. **Immediately** rotate the key in Supabase Dashboard
2. Update `.env` with new key
3. Restart all backend instances
4. Review access logs for suspicious activity
5. Consider resetting user passwords if data was accessed

### If Database is Compromised

1. Take database snapshot immediately
2. Revoke compromised credentials
3. Review and restore from backup if needed
4. Audit all RLS policies
5. Force password reset for all users
6. Notify affected users (if required by law)

## Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
