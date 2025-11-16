# Interface Design

## REST API Endpoints

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| POST | /auth/register | No | User registration |
| POST | /auth/login | No | User login |
| POST | /auth/refresh | No | Refresh access token |
| POST | /auth/logout | Yes | Logout user |
| POST | /auth/forgot-password | No | Request password reset |
| POST | /auth/reset-password | No | Reset password with token |
| GET | /auth/verify-email/:token | No | Verify email address |
| GET | /user/profile | Yes | Get user profile |
| PUT | /user/profile | Yes | Update user profile |
| GET | /user/preferences | Yes | Get user preferences |
| PUT | /user/preferences | Yes | Update user preferences |
| DELETE | /user/account | Yes | Delete user account |
| GET | /user/data-export | Yes | Export user data (GDPR) |
| GET | /bills/search | Yes | Search bills |
| GET | /bills/:billId | Yes | Get bill details |
| POST | /bills/track | Yes | Track a bill |
| DELETE | /bills/track/:billId | Yes | Untrack a bill |
| GET | /bills/tracked | Yes | List tracked bills |
| GET | /bills/tracked/:billId/activity | Yes | Get bill activity summary |
| POST | /briefs/generate | Yes | Generate audio briefing |
| GET | /briefs | Yes | List user briefs |
| GET | /briefs/:briefId | Yes | Get brief details (script, article, audio) |
| GET | /briefs/:briefId/status | Yes | Get generation status |
| PUT | /briefs/:briefId/progress | Yes | Update listening progress |
| PUT | /briefs/:briefId/article-read | Yes | Mark article as read |
| POST | /chat/sessions | Yes | Create chat session |
| GET | /chat/sessions/:sessionId | Yes | Get chat session |
| POST | /chat/sessions/:sessionId/messages | Yes | Send chat message |
| GET | /chat/sessions/:sessionId/messages | Yes | Get message history |
| DELETE | /chat/sessions/:sessionId | Yes | Delete chat session |
| GET | /dashboard | Yes | Get dashboard data |

## Authentication

| Type | Mechanism |
|------|-----------|
| Primary | JWT Bearer Token (RS256, 1-hour expiry) |
| Refresh | Refresh Token (30-day expiry, rotation) |
| OAuth | WorkOS (Google OAuth) |

## Error Response Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate resource |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |
| 502 | Bad Gateway - External API failure |
| 503 | Service Unavailable - Temporary outage |
