# Backend Architecture Guide

## Folder Structure

```
backend/
├── src/
│   ├── config/
│   │   └── supabase.ts           # Supabase client configuration
│   ├── controllers/
│   │   ├── companyController.ts  # Company business logic
│   │   └── linkController.ts     # Share link business logic
│   ├── database/
│   │   ├── schema.sql            # Database schema DDL
│   │   └── rls-policies.sql      # Row Level Security policies
│   ├── middleware/
│   │   └── auth.ts               # Authentication middleware
│   ├── routes/
│   │   ├── companyRoutes.ts      # Company API routes
│   │   └── linkRoutes.ts         # Share link API routes
│   ├── services/
│   │   └── companyService.ts     # Company data access layer
│   ├── types/
│   │   └── index.ts              # TypeScript type definitions
│   └── index.ts                  # Express app entry point
├── .env                          # Environment variables
├── .gitignore                    # Git ignore rules
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── README.md                     # API documentation
└── ARCHITECTURE.md               # This file
```

## Architecture Layers

### 1. Routes Layer (`src/routes/`)
- **Purpose**: Define HTTP endpoints and apply middleware
- **Responsibilities**:
  - Map HTTP methods and paths to controllers
  - Apply authentication/authorization middleware
  - Handle request validation at the route level

### 2. Controllers Layer (`src/controllers/`)
- **Purpose**: Handle HTTP request/response logic
- **Responsibilities**:
  - Extract and validate request data
  - Call service layer for business logic
  - Format and return HTTP responses
  - Handle errors and return appropriate status codes

### 3. Services Layer (`src/services/`)
- **Purpose**: Implement business logic and data access
- **Responsibilities**:
  - Interact with Supabase database
  - Implement business rules
  - Return data or throw errors
  - Keep logic independent of HTTP layer

### 4. Middleware Layer (`src/middleware/`)
- **Purpose**: Process requests before they reach controllers
- **Responsibilities**:
  - Authentication (JWT validation)
  - Authorization (role checks)
  - Request logging
  - Error handling

### 5. Types Layer (`src/types/`)
- **Purpose**: Define TypeScript interfaces and types
- **Responsibilities**:
  - Database entity types
  - Request/Response DTOs
  - Shared type definitions

## Design Principles

### Separation of Concerns
Each layer has a single, well-defined responsibility:
- **Routes**: HTTP routing and middleware
- **Controllers**: Request/response handling
- **Services**: Business logic and data access
- **Middleware**: Cross-cutting concerns

### Dependency Flow
```
Routes → Controllers → Services → Database
         ↓
    Middleware
```

### Error Handling
- Services throw errors
- Controllers catch errors and return appropriate HTTP responses
- Middleware handles uncaught errors globally

### Authentication Flow
1. Client sends JWT token in `Authorization: Bearer <token>` header
2. `authenticateUser` middleware validates token with Supabase Auth
3. User data is attached to `req.user`
4. Controllers access `req.user` for user context

### Public vs Authenticated Endpoints

**Authenticated Endpoints** (require JWT):
- `POST /companies` - Create company
- `GET /companies` - List user's companies
- `GET /companies/:id` - Get company details
- `PATCH /companies/:id` - Update company
- `DELETE /companies/:id` - Delete company
- `POST /links` - Create share link

**Public Endpoints** (no authentication):
- `GET /links/:linkId` - View shared content
- `POST /links/:linkId/log` - Log view event
- `GET /links/:linkId/stats` - View statistics
- `GET /health` - Health check

## Supabase Configuration

### Two Client Instances

1. **Public Client** (`supabase`)
   - Uses `SUPABASE_ANON_KEY`
   - Respects Row Level Security (RLS) policies
   - Used for public endpoints (link viewing)

2. **Admin Client** (`supabaseAdmin`)
   - Uses `SUPABASE_SERVICE_ROLE_KEY`
   - Bypasses Row Level Security (RLS)
   - Used for authenticated operations
   - **NEVER expose to client-side code**

### Why Two Clients?

- **Security**: Admin client has full database access
- **Flexibility**: Public client for VIP guests (no login)
- **RLS**: Public client enforces multi-tenant security policies
- **Auth**: Admin client can verify JWTs and perform privileged operations

## Security Considerations

### 1. JWT Validation
- All authenticated endpoints validate JWT tokens
- Tokens are verified using Supabase Auth's `getUser()` method
- Invalid/expired tokens return 401 Unauthorized

### 2. Ownership Validation
- Company operations validate `owner_user_id` matches authenticated user
- Prevents unauthorized access to other users' data
- Service layer enforces ownership in queries

### 3. Input Validation
- Controllers validate required fields
- Trim user input to prevent injection
- Use Supabase parameterized queries (built-in)

### 4. Service Role Key Protection
- Never commit to version control
- Store in `.env` file (gitignored)
- Only use server-side (never expose to frontend)

### 5. Link ID Generation
- Use `nanoid` for cryptographically secure random IDs
- 12 characters provide ~4.6 billion unique IDs
- URL-safe characters only

### 6. Rate Limiting (Recommended)
- Add rate limiting middleware (e.g., `express-rate-limit`)
- Protect against brute force attacks
- Apply to public endpoints especially

## Best Practices

### 1. Error Messages
- Don't expose internal errors to clients
- Log detailed errors server-side
- Return generic messages to clients

### 2. Logging
- Log all authentication failures
- Log database errors
- Use structured logging (consider Winston or Pino)

### 3. Environment Variables
- Use `.env` file for local development
- Use environment-specific configs for production
- Validate all required env vars on startup

### 4. TypeScript
- Use strict type checking
- Define interfaces for all data structures
- Avoid `any` types

### 5. Database Transactions
- Use transactions for multi-step operations
- Supabase client supports transactions via raw SQL
- Ensure data consistency

## Extending the Architecture

### Adding a New Module

1. **Create Service** (`src/services/newService.ts`)
   ```typescript
   export const getItems = async (userId: string) => {
     const { data, error } = await supabaseAdmin
       .from('items')
       .select('*')
       .eq('user_id', userId);

     if (error) throw new Error(error.message);
     return data;
   };
   ```

2. **Create Controller** (`src/controllers/newController.ts`)
   ```typescript
   export const getItems = async (req: AuthenticatedRequest, res: Response) => {
     try {
       if (!req.user) {
         return res.status(401).json({ error: 'Unauthorized' });
       }
       const items = await newService.getItems(req.user.id);
       res.json({ data: items });
     } catch (error) {
       res.status(500).json({ error: 'Failed to fetch items' });
     }
   };
   ```

3. **Create Routes** (`src/routes/newRoutes.ts`)
   ```typescript
   const router = Router();
   router.use(authenticateUser);
   router.get('/', getItems);
   export default router;
   ```

4. **Register Routes** (`src/index.ts`)
   ```typescript
   import newRoutes from './routes/newRoutes';
   app.use('/items', newRoutes);
   ```

### Adding Middleware

Create in `src/middleware/`:
```typescript
export const customMiddleware = (req, res, next) => {
  // Your logic here
  next();
};
```

Apply in routes:
```typescript
router.get('/', customMiddleware, controller);
```

## Performance Optimization

### Database Indexes
- All foreign keys have indexes
- Add indexes for frequently queried columns
- Use `EXPLAIN ANALYZE` to identify slow queries

### Caching
- Consider Redis for frequently accessed data
- Cache share link lookups
- Cache user company lists

### Connection Pooling
- Supabase client handles connection pooling
- Configure pool size in production if needed

## Testing Recommendations

### Unit Tests
- Test services independently
- Mock Supabase client
- Test business logic thoroughly

### Integration Tests
- Test API endpoints
- Use test database
- Test authentication flows

### Tools
- Jest for unit tests
- Supertest for API tests
- Mock Service Worker for mocking
