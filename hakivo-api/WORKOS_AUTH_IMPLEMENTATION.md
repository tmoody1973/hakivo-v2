# WorkOS AuthKit Integration

## Overview
Successfully integrated WorkOS AuthKit authentication alongside the existing JWT-based authentication system in the auth-service.

## What Was Implemented

### 1. Dependencies Added
- Installed `@workos-inc/node` SDK v5.x

### 2. New Authentication Endpoints

#### `GET /auth/workos/login`
Initiates WorkOS AuthKit authentication flow by redirecting users to the hosted AuthKit login page.

**Environment Variables Required:**
- `WORKOS_API_KEY` - Your WorkOS API key
- `WORKOS_CLIENT_ID` - Your WorkOS client ID
- `WORKOS_REDIRECT_URI` - Callback URL (e.g., `https://your-app.com/auth/workos/callback`)

**Flow:**
1. User clicks "Sign in with WorkOS"
2. Redirected to WorkOS AuthKit
3. User authenticates (email/password, Google, etc.)
4. Redirected back to your callback URL

#### `GET /auth/workos/callback`
Handles the OAuth callback from WorkOS and creates/updates user sessions.

**Process:**
1. Receives authorization code from WorkOS
2. Exchanges code for user profile
3. Creates new user OR links existing user
4. Generates JWT tokens (access + refresh)
5. Stores session in `session-cache` KV (30-day TTL)
6. Returns authentication response with tokens

**Database Updates:**
- Adds `workos_user_id` to users table
- Links WorkOS accounts to local user records
- Auto-creates users from WorkOS profiles

**Response:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "accessToken": "eyJhbGc...",
  "refreshToken": "a1b2c3d4...",
  "sessionId": "uuid",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": true,
    "onboardingCompleted": false
  }
}
```

#### `GET /auth/workos/logout`
Ends the WorkOS session and clears application session.

**Parameters:**
- `sessionId` (query param or `X-Session-ID` header) - Required

**Process:**
1. Deletes session from `session-cache` KV
2. Redirects to WorkOS logout URL
3. User logged out from WorkOS
4. Redirected to configured logout redirect URL

### 3. Session Management

**Storage:** Sessions stored in `session-cache` KV cache
**TTL:** 30 days (auto-expiration)
**Format:**
```json
{
  "userId": "local-user-id",
  "email": "user@example.com",
  "workosUserId": "workos-user-id",
  "createdAt": 1234567890
}
```

### 4. Database Schema Changes

**Users Table - New Column:**
```sql
ALTER TABLE users ADD COLUMN workos_user_id TEXT;
```

This column:
- Links local users to WorkOS user IDs
- Enables account linking for users who sign up with both methods
- Nullable (users can exist without WorkOS accounts)

## Configuration Steps

### 1. Set Environment Variables

Add to your `.env` or Raindrop secrets:

```bash
WORKOS_API_KEY=sk_test_xxxxx
WORKOS_CLIENT_ID=client_xxxxx
WORKOS_REDIRECT_URI=https://your-app.liquidmetal.run/auth/workos/callback
```

To set via Raindrop CLI:
```bash
raindrop build env set env:WORKOS_API_KEY <your-key>
raindrop build env set env:WORKOS_CLIENT_ID <your-client-id>
raindrop build env set env:WORKOS_REDIRECT_URI <your-callback-url>
```

### 2. Configure WorkOS Dashboard

1. Go to [WorkOS Dashboard](https://dashboard.workos.com)
2. Navigate to **Redirects** section
3. Add your callback URL: `https://your-app.liquidmetal.run/auth/workos/callback`
4. Set initiate login URL: `https://your-app.liquidmetal.run/auth/workos/login`
5. Configure logout redirect URL (where users go after logout)

### 3. Update Database Schema

Run this SQL migration on your `app-db`:

```sql
ALTER TABLE users ADD COLUMN workos_user_id TEXT;
CREATE INDEX idx_users_workos_user_id ON users(workos_user_id);
```

## Integration with Frontend

### Sign In with WorkOS

```typescript
// Redirect to WorkOS login
window.location.href = 'https://your-api.com/auth/workos/login';
```

### Handle Callback (if using frontend routing)

```typescript
// After callback, tokens are returned in response
// Store accessToken in memory or httpOnly cookie
// Store refreshToken in httpOnly cookie only
```

### Sign Out

```typescript
const sessionId = localStorage.getItem('sessionId');
window.location.href = `https://your-api.com/auth/workos/logout?sessionId=${sessionId}`;
```

## Authentication Flow Diagram

```
User                    Frontend                auth-service            WorkOS
 |                         |                         |                    |
 | Click "Sign in"         |                         |                    |
 |------------------------>|                         |                    |
 |                         | GET /auth/workos/login  |                    |
 |                         |------------------------>|                    |
 |                         |                         | getAuthorizationUrl|
 |                         |                         |------------------->|
 |                         |            302 Redirect to AuthKit           |
 |                         |<-------------------------------------------|
 | Auth at WorkOS          |                         |                    |
 |----------------------------------------------------------------->|
 |                         |                         |   Authorization    |
 |                         |                         |      Code          |
 |                         | GET /auth/workos/callback?code=xxx          |
 |                         |------------------------>|                    |
 |                         |                         | authenticateWithCode
 |                         |                         |------------------->|
 |                         |                         |<-- User Profile ---|
 |                         |                         |                    |
 |                         |                         | Create/Update User |
 |                         |                         | Generate Tokens    |
 |                         |                         | Store Session (KV) |
 |                         |<-- { tokens, user } ----|                    |
 | Authenticated!          |                         |                    |
```

## Dual Authentication Support

The auth-service now supports **two authentication methods**:

### 1. Email/Password (JWT)
- **Endpoints:** `/auth/register`, `/auth/login`, `/auth/logout`
- **Tokens:** Custom JWT with refresh tokens
- **Use Case:** Users who prefer traditional authentication

### 2. WorkOS AuthKit (OAuth)
- **Endpoints:** `/auth/workos/login`, `/auth/workos/callback`, `/auth/workos/logout`
- **Tokens:** JWT after OAuth exchange
- **Use Case:** Users who prefer social login (Google, GitHub, etc.)

**Both methods:**
- Generate compatible JWT access tokens
- Store sessions in the same format
- Work with the same `/auth/me` endpoint
- Use the same refresh token mechanism

## Onboarding & Settings Endpoints

### Available Endpoints

After authentication, users can complete onboarding and manage their preferences through these endpoints:

#### `GET /auth/onboarding`
Get available interest categories for user selection.

**Response:**
```json
{
  "success": true,
  "interests": [
    {
      "name": "Environment & Energy",
      "policyAreas": ["Environmental Protection", "Energy", ...],
      "keywords": ["climate", "pollution", ...]
    },
    // ... 11 more categories
  ]
}
```

#### `POST /auth/onboarding`
Complete onboarding with user interests and optional personal information.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "interests": ["Environment & Energy", "Health & Social Welfare"],
  "firstName": "John",      // optional - update if needed
  "lastName": "Doe",        // optional - update if needed
  "zipCode": "10001",       // optional - triggers district lookup
  "city": "New York"        // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Onboarding completed successfully",
  "interests": ["Environment & Energy", "Health & Social Welfare"]
}
```

**Features:**
- Validates interests against 12 available categories
- Updates user preferences in database
- Optionally updates personal information (firstName, lastName, zipCode, city)
- Automatically looks up Congressional district from zip code
- Marks user's `onboarding_completed` flag as true

#### `GET /auth/settings`
Get current user preferences and profile information.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "preferences": {
    "policyInterests": ["Environment & Energy", "Health & Social Welfare"],
    "briefingTime": "08:00",
    "briefingDays": ["Monday", "Wednesday", "Friday"],
    "playbackSpeed": 1.0,
    "autoplay": true,
    "emailNotifications": true
  },
  "user": {
    "firstName": "John",
    "lastName": "Doe",
    "zipCode": "10001",
    "city": "New York",
    "congressionalDistrict": "NY-12"
  }
}
```

#### `PUT /auth/settings/interests`
Update user's policy interests.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "interests": ["Economy & Finance", "Education & Science"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Interests updated successfully",
  "interests": ["Economy & Finance", "Education & Science"]
}
```

### Frontend Integration Example

```typescript
// After successful authentication, redirect to onboarding
// 1. Get available interests
const interestsResponse = await fetch('/auth/onboarding');
const { interests } = await interestsResponse.json();

// 2. Show UI for user to select interests
// 3. Submit onboarding data
const onboardingResponse = await fetch('/auth/onboarding', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    interests: selectedInterests,
    zipCode: userZipCode
  })
});

// 4. Later, in settings page, allow updates
const updateResponse = await fetch('/auth/settings/interests', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    interests: newSelectedInterests
  })
});
```

### Available Interest Categories

1. **Environment & Energy** - Climate, pollution, renewables, conservation
2. **Health & Social Welfare** - Healthcare, insurance, public health, welfare
3. **Economy & Finance** - Budget, inflation, taxes, financial institutions
4. **Education & Science** - Schools, universities, STEM, research
5. **Civil Rights & Law** - Equality, justice, discrimination, law enforcement
6. **Commerce & Labor** - Business, jobs, workforce, employment
7. **Government & Politics** - Elections, governance, legislation
8. **Foreign Policy & Defense** - Military, defense, trade agreements
9. **Housing & Urban Development** - Housing, infrastructure, transportation
10. **Agriculture & Food** - Farming, food security, rural areas
11. **Sports, Arts & Culture** - Sports, arts, culture, recreation
12. **Immigration & Indigenous Issues** - Immigration, border, indigenous rights

## Next Steps

1. ✅ **Database migration completed** - `workos_user_id` column added
2. ✅ **Onboarding endpoints implemented** - Interest selection and personal info
3. ✅ **Settings endpoints implemented** - View and update preferences
4. **Configure WorkOS Dashboard** - Set up redirect URLs
5. **Test authentication flow** - Try signing in via WorkOS
6. **Update frontend** - Add "Sign in with WorkOS" button and onboarding UI

## Security Considerations

✅ **Implemented:**
- Sessions encrypted and stored in KV cache
- JWT tokens with short expiration (15 min access, 30 day refresh)
- WorkOS handles password security
- Authorization code flow (OAuth 2.0 standard)

⚠️ **TODO:**
- Set up HTTPS in production
- Use httpOnly cookies for tokens in frontend
- Implement CSRF protection for state parameter
- Add rate limiting to callback endpoint
- Configure WorkOS MFA for enhanced security

## Troubleshooting

### "WorkOS configuration missing" error
- Ensure `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, and `WORKOS_REDIRECT_URI` are set
- Check environment variables with `raindrop build env get env:WORKOS_API_KEY`

### "Missing authorization code" error
- Verify redirect URI in WorkOS dashboard matches exactly
- Check for typos in callback URL configuration

### User not created in database
- Ensure `workos_user_id` column exists in users table
- Check database logs for constraint violations
- Verify user-service is accessible from auth-service

## Resources

- [WorkOS AuthKit Documentation](https://workos.com/docs/user-management)
- [WorkOS Node SDK](https://github.com/workos/workos-node)
- [OAuth 2.0 Authorization Code Flow](https://oauth.net/2/grant-types/authorization-code/)
