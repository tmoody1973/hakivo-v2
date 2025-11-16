# Hakivo API Endpoints Specification

**Complete Backend API Reference for Implementation**

This document provides exact specifications for every API endpoint needed by the Hakivo frontend. Backend developers can implement these endpoints without additional questions.

---

## Table of Contents

1. [Authentication & User Management](#1-authentication--user-management)
2. [User Profile & Preferences](#2-user-profile--preferences)
3. [Legislative Data](#3-legislative-data)
4. [Bill Tracking](#4-bill-tracking)
5. [Audio Briefings](#5-audio-briefings)
6. [RAG Chat System](#6-rag-chat-system)
7. [Dashboard Data](#7-dashboard-data)
8. [AI Services Integration](#8-ai-services-integration)

---

## Global Specifications

### Base URL
```
Production: https://api.hakivo.com/v1
Development: http://localhost:3001/api
```

### Authentication
All authenticated endpoints require:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

**Token Format**: JWT signed with RS256
**Token Expiry**: 1 hour
**Refresh Token Expiry**: 30 days

### Standard Response Format
```typescript
{
  "success": boolean,
  "data"?: any,
  "error"?: {
    "code": string,
    "message": string,
    "details"?: any
  },
  "metadata"?: {
    "timestamp": string,
    "requestId": string
  }
}
```

### Standard Error Codes
- `UNAUTHORIZED` (401): Invalid or expired token
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Invalid request data
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error
- `SERVICE_UNAVAILABLE` (503): External service down

### Rate Limiting
- **Default**: 100 requests per minute per user
- **Heavy endpoints** (briefs generation): 10 requests per hour
- **Headers returned**:
  ```http
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 95
  X-RateLimit-Reset: 1640000000
  ```

### Pagination
List endpoints support:
```http
GET /endpoint?page=1&limit=20&sort=createdAt&order=desc
```

**Response format**:
```typescript
{
  "success": true,
  "data": {
    "data": Array<T>,
    "pagination": {
      "page": number,
      "limit": number,
      "total": number,
      "totalPages": number,
      "hasMore": boolean
    }
  }
}
```

---

## 1. Authentication & User Management

### 1.1 OAuth Login (Google)

**Endpoint**: `POST /auth/oauth/google`
**Authentication**: None
**Rate Limit**: 20 per hour per IP

**Request Body**:
```typescript
{
  "code": string,              // OAuth authorization code from Google
  "redirectUri": string        // Must match registered OAuth redirect
}
```

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "session": {
      "accessToken": string,   // JWT, expires in 1 hour
      "refreshToken": string,  // Expires in 30 days
      "expiresAt": string      // ISO 8601 timestamp
    },
    "user": {
      "id": string,
      "email": string,
      "firstName": string,
      "lastName": string,
      "profileImageUrl": string | null,
      "onboardingCompleted": boolean,
      "createdAt": string,
      "lastLoginAt": string
    }
  }
}
```

**Error Responses**:
- `400 INVALID_AUTH_CODE`: Invalid or expired OAuth code
- `403 ACCOUNT_SUSPENDED`: User account suspended
- `429 RATE_LIMIT_EXCEEDED`: Too many auth attempts
- `500 OAUTH_PROVIDER_ERROR`: Google OAuth service error

**Validation**:
- `code`: Required, non-empty string
- `redirectUri`: Required, valid URL, must match OAuth config

---

### 1.2 Email/Password Login

**Endpoint**: `POST /auth/login`
**Authentication**: None
**Rate Limit**: 10 per 15 minutes per IP

**Request Body**:
```typescript
{
  "email": string,
  "password": string
}
```

**Success Response (200)**: Same as OAuth login

**Error Responses**:
- `401 INVALID_CREDENTIALS`: Wrong email/password
- `403 EMAIL_NOT_VERIFIED`: Email verification required
- `429 TOO_MANY_ATTEMPTS`: Account temporarily locked (5 failed attempts)
- `500 INTERNAL_ERROR`: Server error

**Validation**:
- `email`: Required, valid email format, max 255 chars
- `password`: Required, min 8 chars, max 128 chars

---

### 1.3 Refresh Token

**Endpoint**: `POST /auth/refresh`
**Authentication**: None
**Rate Limit**: 100 per hour

**Request Body**:
```typescript
{
  "refreshToken": string
}
```

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "accessToken": string,
    "refreshToken": string,    // New refresh token (token rotation)
    "expiresAt": string
  }
}
```

**Error Responses**:
- `401 INVALID_REFRESH_TOKEN`: Token invalid or expired
- `403 TOKEN_REVOKED`: Token was revoked (logout)

---

### 1.4 Logout

**Endpoint**: `POST /auth/logout`
**Authentication**: Required
**Rate Limit**: 100 per hour

**Request Body**:
```typescript
{
  "refreshToken": string       // Revoke this specific refresh token
}
```

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

### 1.5 Get Current User

**Endpoint**: `GET /users/me`
**Authentication**: Required
**Rate Limit**: 100 per minute

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "id": string,
    "email": string,
    "firstName": string,
    "lastName": string,
    "profileImageUrl": string | null,
    "zipCode": string,
    "city": string,
    "state": string | null,
    "congressionalDistrict": string | null,  // e.g., "CA-12"
    "onboardingCompleted": boolean,
    "emailVerified": boolean,
    "createdAt": string,
    "updatedAt": string,
    "lastLoginAt": string
  }
}
```

---

## 2. User Profile & Preferences

### 2.1 Update User Profile

**Endpoint**: `PATCH /users/me`
**Authentication**: Required
**Rate Limit**: 20 per hour

**Request Body** (all fields optional):
```typescript
{
  "firstName"?: string,
  "lastName"?: string,
  "zipCode"?: string,
  "city"?: string,
  "profileImageUrl"?: string
}
```

**Success Response (200)**: Returns updated user object (same as GET /users/me)

**Error Responses**:
- `400 VALIDATION_ERROR`: Invalid field values
- `400 INVALID_ZIP_CODE`: ZIP code doesn't exist or invalid format

**Validation**:
- `firstName`: 1-50 chars, letters/spaces/hyphens only
- `lastName`: 1-50 chars, letters/spaces/hyphens only
- `zipCode`: Exactly 5 digits, must be valid US ZIP
- `city`: 1-100 chars
- `profileImageUrl`: Valid HTTPS URL, max 500 chars

**Side Effects**:
- When `zipCode` changes, automatically fetch and update `congressionalDistrict` using Geocodio API
- Update `updatedAt` timestamp

---

### 2.2 Get User Preferences

**Endpoint**: `GET /users/me/preferences`
**Authentication**: Required
**Rate Limit**: 100 per minute

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "policyInterests": string[],  // Array of policy interest IDs
    "briefingTime": string,       // HH:MM format, e.g., "08:00"
    "briefingDays": string[],     // ["monday", "tuesday", ...]
    "playbackSpeed": number,      // 0.75, 1.0, 1.25, 1.5, 1.75, 2.0
    "autoplay": boolean,
    "emailNotifications": boolean,
    "billUpdateNotifications": boolean,
    "weeklySummaryEnabled": boolean,
    "updatedAt": string
  }
}
```

---

### 2.3 Update User Preferences

**Endpoint**: `PATCH /users/me/preferences`
**Authentication**: Required
**Rate Limit**: 20 per hour

**Request Body** (all fields optional):
```typescript
{
  "policyInterests"?: string[],
  "briefingTime"?: string,
  "briefingDays"?: string[],
  "playbackSpeed"?: number,
  "autoplay"?: boolean,
  "emailNotifications"?: boolean,
  "billUpdateNotifications"?: boolean,
  "weeklySummaryEnabled"?: boolean
}
```

**Success Response (200)**: Returns updated preferences object

**Validation**:
- `policyInterests`: Array of 1-12 valid interest IDs (see list below)
- `briefingTime`: Valid HH:MM format (00:00 to 23:59)
- `briefingDays`: Array containing valid days: `["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]`
- `playbackSpeed`: One of `[0.75, 1.0, 1.25, 1.5, 1.75, 2.0]`
- `autoplay`: Boolean
- `emailNotifications`: Boolean
- `billUpdateNotifications`: Boolean
- `weeklySummaryEnabled`: Boolean

**Valid Policy Interest IDs**:
```typescript
[
  "environment-energy",
  "health-welfare",
  "economy-finance",
  "education-science",
  "civil-rights-law",
  "commerce-labor",
  "government-politics",
  "foreign-policy-defense",
  "housing-urban",
  "agriculture-food",
  "sports-arts-culture",
  "immigration-indigenous"
]
```

---

### 2.4 Save Onboarding Preferences

**Endpoint**: `POST /users/me/onboarding`
**Authentication**: Required
**Rate Limit**: 5 per hour

**Request Body**:
```typescript
{
  "policyInterests": string[],     // Required, min 1 interest
  "briefingTime": string,          // Required
  "briefingDays": string[],        // Required
  "playbackSpeed": number,
  "autoplay": boolean,
  "emailNotifications": boolean
}
```

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "user": {
      // Updated user object with onboardingCompleted: true
    },
    "preferences": {
      // Created preferences object
    }
  }
}
```

**Side Effects**:
- Sets `user.onboardingCompleted = true`
- Creates initial user preferences
- Triggers first brief generation (async job)

---

## 3. Legislative Data

**Note**: These endpoints proxy to Congress.gov API with caching

### 3.1 Search Bills

**Endpoint**: `GET /legislation/bills`
**Authentication**: Optional (better results when authenticated - can use user preferences)
**Rate Limit**: 60 per minute
**Cache**: 15 minutes

**Query Parameters**:
```typescript
{
  query?: string,              // Search term
  congress?: number,           // 118 or 119 (default: current)
  billType?: "hr" | "s" | "hjres" | "sjres" | "hconres" | "sconres" | "hres" | "sres",
  chamber?: "house" | "senate",
  status?: "introduced" | "passed_house" | "passed_senate" | "enacted" | "vetoed",
  policyArea?: string,         // e.g., "Health", "Environment"
  page?: number,               // Default: 1
  limit?: number               // Default: 20, max: 100
}
```

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "bills": Array<{
      "congress": number,
      "type": string,
      "number": string,
      "title": string,
      "introducedDate": string,
      "latestAction": {
        "text": string,
        "actionDate": string
      },
      "sponsors": Array<{
        "name": string,
        "party": string,
        "state": string
      }>,
      "policyArea": string | null,
      "subjects": string[],
      "tracked": boolean          // If authenticated, shows if user tracks this bill
    }>,
    "pagination": {
      "page": number,
      "limit": number,
      "total": number,
      "totalPages": number,
      "hasMore": boolean
    }
  }
}
```

**Error Responses**:
- `400 INVALID_CONGRESS`: Congress number must be 118 or 119
- `400 INVALID_LIMIT`: Limit must be 1-100
- `503 CONGRESS_API_UNAVAILABLE`: Congress.gov API is down

---

### 3.2 Get Bill by ID

**Endpoint**: `GET /legislation/bills/:congress/:type/:number`
**Authentication**: Optional
**Rate Limit**: 100 per minute
**Cache**: 30 minutes

**Path Parameters**:
- `congress`: 118 or 119
- `type`: Bill type (hr, s, etc.)
- `number`: Bill number (e.g., "1234")

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "congress": number,
    "type": string,
    "number": string,
    "title": string,
    "summary": string | null,
    "introducedDate": string,
    "latestAction": {
      "text": string,
      "actionDate": string
    },
    "sponsors": Array<{
      "bioguideId": string,
      "name": string,
      "party": string,
      "state": string,
      "district": string | null
    }>,
    "cosponsors": Array<{...}>,  // Same structure as sponsors
    "policyArea": string | null,
    "subjects": string[],
    "actions": Array<{
      "date": string,
      "text": string,
      "type": string,
      "actionCode": string | null
    }>,
    "textVersions": Array<{
      "type": string,           // "Introduced", "Engrossed", etc.
      "date": string,
      "url": string
    }>,
    "tracked": boolean,
    "trackCount": number         // How many users track this bill
  }
}
```

**Error Responses**:
- `404 BILL_NOT_FOUND`: Bill doesn't exist
- `400 INVALID_BILL_ID`: Malformed bill identifier

---

### 3.3 Get Congressional Members

**Endpoint**: `GET /legislation/members`
**Authentication**: Optional
**Rate Limit**: 60 per minute
**Cache**: 1 hour

**Query Parameters**:
```typescript
{
  chamber?: "house" | "senate",
  state?: string,              // Two-letter state code
  party?: "D" | "R" | "I",
  query?: string,              // Search by name
  page?: number,
  limit?: number               // Default: 50, max: 250
}
```

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "members": Array<{
      "bioguideId": string,
      "name": string,
      "party": string,
      "state": string,
      "district": string | null,   // House only
      "chamber": "house" | "senate",
      "profileImageUrl": string | null,
      "phoneNumber": string | null,
      "website": string | null,
      "twitter": string | null,
      "termStart": string,
      "termEnd": string
    }>,
    "pagination": {...}
  }
}
```

---

### 3.4 Get Member by ID

**Endpoint**: `GET /legislation/members/:bioguideId`
**Authentication**: Optional
**Rate Limit**: 100 per minute
**Cache**: 1 hour

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "bioguideId": string,
    "name": string,
    "party": string,
    "state": string,
    "district": string | null,
    "chamber": "house" | "senate",
    "profileImageUrl": string | null,
    "phoneNumber": string | null,
    "website": string | null,
    "twitter": string | null,
    "officeAddress": string | null,
    "termStart": string,
    "termEnd": string,
    "committees": Array<{
      "name": string,
      "type": string,
      "chamber": string
    }>,
    "sponsoredBills": Array<{
      "congress": number,
      "type": string,
      "number": string,
      "title": string,
      "introducedDate": string
    }>,
    "sponsoredBillsCount": number,
    "cosponsoredBillsCount": number
  }
}
```

---

## 4. Bill Tracking

### 4.1 Get Tracked Bills

**Endpoint**: `GET /users/me/tracked-bills`
**Authentication**: Required
**Rate Limit**: 100 per minute

**Query Parameters**:
```typescript
{
  status?: "active" | "passed" | "failed",
  policyArea?: string,
  page?: number,
  limit?: number               // Default: 20, max: 100
}
```

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "data": Array<{
      "id": string,              // Tracking record ID
      "billId": string,          // Format: "{congress}-{type}-{number}"
      "congress": number,
      "billType": string,
      "billNumber": string,
      "title": string,
      "trackedAt": string,
      "lastChecked": string,
      "hasNewActivity": boolean,
      "latestAction": {
        "text": string,
        "actionDate": string
      },
      "notificationsEnabled": boolean,
      "notes": string | null     // User's personal notes on this bill
    }>,
    "pagination": {...}
  }
}
```

---

### 4.2 Track Bill

**Endpoint**: `POST /users/me/tracked-bills`
**Authentication**: Required
**Rate Limit**: 30 per hour

**Request Body**:
```typescript
{
  "billId": string,              // Format: "119-hr-1234"
  "notificationsEnabled"?: boolean,
  "notes"?: string
}
```

**Success Response (201)**:
```typescript
{
  "success": true,
  "data": {
    "id": string,
    "billId": string,
    // ... full tracked bill object
  }
}
```

**Error Responses**:
- `400 INVALID_BILL_ID`: Malformed bill ID
- `404 BILL_NOT_FOUND`: Bill doesn't exist in Congress.gov
- `409 ALREADY_TRACKING`: User already tracks this bill
- `403 TRACKING_LIMIT_EXCEEDED`: Max 100 tracked bills per user

**Validation**:
- `billId`: Required, format `{congress}-{type}-{number}`
- `notes`: Max 1000 characters

**Side Effects**:
- Creates tracking record
- Subscribes to bill updates if `notificationsEnabled: true`

---

### 4.3 Untrack Bill

**Endpoint**: `DELETE /users/me/tracked-bills/:trackingId`
**Authentication**: Required
**Rate Limit**: 30 per hour

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "message": "Bill untracked successfully"
  }
}
```

**Error Responses**:
- `404 TRACKING_NOT_FOUND`: Tracking record doesn't exist or doesn't belong to user

---

### 4.4 Update Tracked Bill

**Endpoint**: `PATCH /users/me/tracked-bills/:trackingId`
**Authentication**: Required
**Rate Limit**: 30 per hour

**Request Body** (all optional):
```typescript
{
  "notificationsEnabled"?: boolean,
  "notes"?: string
}
```

**Success Response (200)**: Returns updated tracked bill object

---

## 5. Audio Briefings

### 5.1 Get Briefs

**Endpoint**: `GET /users/me/briefs`
**Authentication**: Required
**Rate Limit**: 100 per minute

**Query Parameters**:
```typescript
{
  type?: "daily" | "weekly",
  status?: "generating" | "completed" | "failed",
  page?: number,
  limit?: number               // Default: 20, max: 50
}
```

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "data": Array<{
      "id": string,
      "type": "daily" | "weekly",
      "title": string,
      "date": string,            // ISO 8601 date
      "duration": number,        // Seconds
      "audioUrl": string | null,
      "scriptUrl": string | null,
      "status": "generating" | "completed" | "failed",
      "listened": boolean,
      "listenedAt": string | null,
      "progress": number,        // 0-100, playback progress
      "createdAt": string,
      "generatedAt": string | null,
      "failureReason": string | null
    }>,
    "pagination": {...}
  }
}
```

---

### 5.2 Get Brief by ID

**Endpoint**: `GET /users/me/briefs/:briefId`
**Authentication**: Required
**Rate Limit**: 100 per minute

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "id": string,
    "type": "daily" | "weekly",
    "title": string,
    "date": string,
    "duration": number,
    "audioUrl": string | null,
    "scriptUrl": string | null,
    "script": string | null,   // Full script text
    "status": "generating" | "completed" | "failed",
    "listened": boolean,
    "listenedAt": string | null,
    "progress": number,
    "contentSummary": {
      "newsArticlesCount": number,
      "billUpdatesCount": number,
      "policyAreas": string[]
    },
    "createdAt": string,
    "generatedAt": string | null,
    "failureReason": string | null
  }
}
```

**Error Responses**:
- `404 BRIEF_NOT_FOUND`: Brief doesn't exist or doesn't belong to user

---

### 5.3 Generate Brief

**Endpoint**: `POST /users/me/briefs`
**Authentication**: Required
**Rate Limit**: 10 per hour (HEAVY endpoint)

**Request Body**:
```typescript
{
  "type": "daily" | "weekly",
  "date"?: string              // ISO 8601 date, defaults to today
}
```

**Success Response (202)** - Accepted (async generation):
```typescript
{
  "success": true,
  "data": {
    "id": string,
    "type": "daily" | "weekly",
    "status": "generating",
    "estimatedCompletionTime": string,  // ISO 8601, usually 2-5 minutes
    "createdAt": string
  }
}
```

**Error Responses**:
- `409 BRIEF_ALREADY_EXISTS`: Brief for this date already exists
- `400 INSUFFICIENT_CONTENT`: Not enough tracked bills or preferences to generate brief
- `429 GENERATION_LIMIT_EXCEEDED`: Already 10 pending generations

**Validation**:
- `type`: Required, must be "daily" or "weekly"
- `date`: Optional, valid ISO 8601 date, not future dated

**Side Effects**:
- Creates brief record with status "generating"
- Queues async job that:
  1. Fetches user preferences and tracked bills
  2. Calls Exa.ai for news (daily) or Congress.gov for enacted laws (weekly)
  3. Calls Claude 4.5 Sonnet to generate script
  4. Calls ElevenLabs to generate audio
  5. Uploads audio to Vultr S3
  6. Updates brief status to "completed"
  7. Sends notification if enabled

**Generation Time**: 2-5 minutes typically

---

### 5.4 Mark Brief as Listened

**Endpoint**: `POST /users/me/briefs/:briefId/listened`
**Authentication**: Required
**Rate Limit**: 100 per minute

**Request Body**:
```typescript
{
  "progress": number           // 0-100, playback position
}
```

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "listened": true,
    "listenedAt": string,
    "progress": number
  }
}
```

**Validation**:
- `progress`: Required, number between 0-100

**Side Effects**:
- Sets `listened: true` if progress >= 95
- Updates `listenedAt` timestamp
- Increments user's total listen stats

---

## 6. RAG Chat System

### 6.1 Get Chat Sessions

**Endpoint**: `GET /users/me/chat/sessions`
**Authentication**: Required
**Rate Limit**: 100 per minute

**Query Parameters**:
```typescript
{
  billId?: string,             // Filter by specific bill
  page?: number,
  limit?: number               // Default: 20, max: 50
}
```

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "data": Array<{
      "id": string,
      "billId": string,
      "billTitle": string,
      "messageCount": number,
      "lastMessageAt": string,
      "createdAt": string,
      "updatedAt": string
    }>,
    "pagination": {...}
  }
}
```

---

### 6.2 Get Chat Messages

**Endpoint**: `GET /users/me/chat/sessions/:sessionId/messages`
**Authentication**: Required
**Rate Limit**: 100 per minute

**Query Parameters**:
```typescript
{
  page?: number,
  limit?: number               // Default: 50, max: 100
}
```

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "session": {
      "id": string,
      "billId": string,
      "billTitle": string
    },
    "messages": Array<{
      "id": string,
      "role": "user" | "assistant",
      "content": string,
      "sources": Array<{        // Only for assistant messages
        "section": string,
        "text": string,
        "relevance": number
      }> | null,
      "createdAt": string
    }>,
    "pagination": {...}
  }
}
```

---

### 6.3 Send Chat Message

**Endpoint**: `POST /users/me/chat/sessions/:sessionId/messages`
**Authentication**: Required
**Rate Limit**: 30 per minute

**Request Body**:
```typescript
{
  "message": string            // User's question about the bill
}
```

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "userMessage": {
      "id": string,
      "role": "user",
      "content": string,
      "createdAt": string
    },
    "assistantMessage": {
      "id": string,
      "role": "assistant",
      "content": string,
      "sources": Array<{
        "section": string,
        "text": string,
        "relevance": number
      }>,
      "createdAt": string
    }
  }
}
```

**Error Responses**:
- `404 SESSION_NOT_FOUND`: Chat session doesn't exist
- `400 EMPTY_MESSAGE`: Message cannot be empty
- `503 AI_SERVICE_UNAVAILABLE`: Cerebras API is down
- `503 VECTOR_DB_UNAVAILABLE`: Pinecone is down

**Validation**:
- `message`: Required, 1-2000 characters, trimmed

**Side Effects**:
- Stores user message
- Performs vector search in Pinecone for relevant bill sections
- Calls Cerebras llama3.1-70b with context
- Stores assistant message with sources
- Updates session's `lastMessageAt` and `messageCount`

**Processing Time**: 1-3 seconds typically

---

### 6.4 Create Chat Session

**Endpoint**: `POST /users/me/chat/sessions`
**Authentication**: Required
**Rate Limit**: 30 per hour

**Request Body**:
```typescript
{
  "billId": string,            // Format: "119-hr-1234"
  "initialMessage": string     // First user question
}
```

**Success Response (201)**:
```typescript
{
  "success": true,
  "data": {
    "session": {
      "id": string,
      "billId": string,
      "billTitle": string,
      "createdAt": string
    },
    "userMessage": {...},
    "assistantMessage": {...}
  }
}
```

**Error Responses**:
- `400 INVALID_BILL_ID`: Malformed bill ID
- `404 BILL_NOT_FOUND`: Bill doesn't exist
- `404 BILL_NOT_VECTORIZED`: Bill text not yet processed for RAG
- `403 CHAT_LIMIT_EXCEEDED`: Max 50 active sessions per user

**Validation**:
- `billId`: Required, format `{congress}-{type}-{number}`
- `initialMessage`: Required, 1-2000 characters

**Side Effects**:
- Creates chat session
- Processes initial message (same as Send Chat Message)

---

### 6.5 Delete Chat Session

**Endpoint**: `DELETE /users/me/chat/sessions/:sessionId`
**Authentication**: Required
**Rate Limit**: 30 per hour

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "message": "Chat session deleted successfully"
  }
}
```

**Error Responses**:
- `404 SESSION_NOT_FOUND`: Session doesn't exist or doesn't belong to user

**Side Effects**:
- Soft deletes session and all associated messages

---

## 7. Dashboard Data

### 7.1 Get Dashboard Data

**Endpoint**: `GET /users/me/dashboard`
**Authentication**: Required
**Rate Limit**: 60 per minute
**Cache**: 5 minutes

**Success Response (200)**:
```typescript
{
  "success": true,
  "data": {
    "user": {
      "id": string,
      "firstName": string,
      "lastName": string,
      "profileImageUrl": string | null
    },
    "upcomingBrief": {
      "id": string,
      "type": "daily" | "weekly",
      "title": string,
      "scheduledFor": string,   // Next briefing time based on user preferences
      "status": "pending" | "generating" | "ready"
    } | null,
    "recentBriefs": Array<{
      "id": string,
      "type": "daily" | "weekly",
      "title": string,
      "date": string,
      "duration": number,
      "audioUrl": string,
      "listened": boolean
    }>,
    "trackedBills": Array<{
      "id": string,
      "billId": string,
      "title": string,
      "hasNewActivity": boolean,
      "latestAction": {
        "text": string,
        "actionDate": string
      }
    }>,
    "newsHighlights": Array<{
      "title": string,
      "source": string,
      "url": string,
      "publishedAt": string,
      "relevance": number        // Based on user's policy interests
    }>,
    "stats": {
      "totalBriefsListened": number,
      "trackedBillsCount": number,
      "minutesListened": number,
      "currentStreak": number    // Consecutive days with listened briefs
    },
    "recommendations": Array<{
      "type": "bill" | "member" | "topic",
      "id": string,
      "title": string,
      "reason": string           // Why it's recommended
    }>
  }
}
```

**Performance Notes**:
- This endpoint aggregates data from multiple sources
- Implement efficient caching (5 minutes)
- Use database indexes on user_id, listened status, dates
- Consider background job to pre-compute dashboard data

---

## 8. AI Services Integration

These endpoints are called by your backend services, not directly by the frontend. Documented here for completeness.

### 8.1 Generate Script (Claude)

**Internal Endpoint**: Used by brief generation job

**External API**: `POST https://api.anthropic.com/v1/messages`

**Headers**:
```http
x-api-key: YOUR_ANTHROPIC_API_KEY
anthropic-version: 2023-06-01
Content-Type: application/json
```

**Request Body**:
```typescript
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 8192,
  "temperature": 0.7,
  "system": "You are a podcast script writer creating conversational legislative briefings...",
  "messages": [{
    "role": "user",
    "content": "Generate a 7-9 minute daily briefing script..."
  }]
}
```

**Cost**: ~$0.15 per daily brief (10K tokens)

---

### 8.2 Generate Audio (ElevenLabs)

**Internal Endpoint**: Used by brief generation job

**External API**: `POST https://api.elevenlabs.io/v1/text-to-dialogue`

**Headers**:
```http
xi-api-key: YOUR_ELEVENLABS_API_KEY
Content-Type: application/json
```

**Request Body**:
```typescript
{
  "model_id": "eleven_v3",
  "dialogue": [
    {
      "speaker": "Sarah",
      "text": "Good morning! Welcome to your daily legislative briefing...",
      "voice_id": "VOICE_ID_SARAH"
    },
    {
      "speaker": "James",
      "text": "Today we're covering three major developments...",
      "voice_id": "VOICE_ID_JAMES"
    }
  ],
  "output_format": "mp3_44100_128",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75
  }
}
```

**Cost**: ~$0.29 per 9-minute brief

---

### 8.3 Bill Analysis (Cerebras)

**Internal Endpoint**: Used by chat system

**External API**: `POST https://api.cerebras.ai/v1/chat/completions`

**Headers**:
```http
Authorization: Bearer YOUR_CEREBRAS_API_KEY
Content-Type: application/json
```

**Request Body**:
```typescript
{
  "model": "llama3.1-70b",
  "messages": [
    {
      "role": "system",
      "content": "You are an expert legislative analyst..."
    },
    {
      "role": "user",
      "content": `Context: [Bill sections from vector search]

      Question: ${userQuestion}`
    }
  ],
  "temperature": 0.3,
  "max_tokens": 1000
}
```

**Cost**: ~$0.01 per chat message

---

### 8.4 News Search (Exa.ai)

**Internal Endpoint**: Used by brief generation

**External API**: `POST https://api.exa.ai/search`

**Headers**:
```http
x-api-key: YOUR_EXA_API_KEY
Content-Type: application/json
```

**Request Body**:
```typescript
{
  "query": "climate change legislation",
  "type": "neural",
  "useAutoprompt": true,
  "numResults": 10,
  "startPublishedDate": "2025-01-15T00:00:00.000Z",
  "endPublishedDate": "2025-01-16T00:00:00.000Z",
  "category": "news"
}
```

**Cost**: ~$0.01 per search

---

## Error Handling Best Practices

### Frontend Error Handling

All API calls should handle these standard cases:

```typescript
try {
  const response = await apiCall();

  if (!response.success) {
    // Handle API error
    switch (response.error?.code) {
      case 'UNAUTHORIZED':
        // Redirect to login, clear tokens
        break;
      case 'RATE_LIMIT_EXCEEDED':
        // Show retry UI with countdown
        break;
      case 'VALIDATION_ERROR':
        // Show field-specific errors
        break;
      default:
        // Show generic error message
    }
  }

  return response.data;
} catch (error) {
  // Handle network errors, timeout, etc.
  if (error.name === 'AbortError') {
    // Request was cancelled
  } else {
    // Show "connection error" UI
  }
}
```

### Retry Logic

Implement exponential backoff for failed requests:

```typescript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(Math.pow(2, i) * 1000);  // 1s, 2s, 4s
    }
  }
}
```

### Offline Detection

```typescript
window.addEventListener('online', () => {
  // Retry failed requests
  retryQueue.forEach(request => request.retry());
});

window.addEventListener('offline', () => {
  // Show offline banner
  // Queue requests for later
});
```

---

## Webhook Events (Optional Future Enhancement)

For real-time updates, consider implementing webhooks:

### Bill Update Webhook

```http
POST /webhooks/bill-updates
```

**Payload**:
```typescript
{
  "event": "bill.action_added",
  "billId": "119-hr-1234",
  "action": {
    "text": "Passed House",
    "date": "2025-01-16"
  },
  "affectedUsers": string[]  // User IDs who track this bill
}
```

### Brief Ready Webhook

```http
POST /webhooks/brief-ready
```

**Payload**:
```typescript
{
  "event": "brief.completed",
  "briefId": string,
  "userId": string,
  "audioUrl": string
}
```

---

## Security Considerations

### Input Sanitization
- All user input must be sanitized to prevent XSS
- SQL injection prevention: use parameterized queries
- Validate all enum values against allowed lists

### Rate Limiting
- Implement rate limiting at multiple levels:
  - Per IP address (prevents DDoS)
  - Per user (prevents abuse)
  - Per endpoint (protects expensive operations)

### Authentication
- JWTs must be signed with RS256 (asymmetric)
- Store refresh tokens hashed in database
- Implement token rotation on refresh
- Revoke all tokens on password change

### Data Privacy
- Never log user passwords or tokens
- Encrypt sensitive data at rest
- Use HTTPS only (enforce)
- Implement CORS properly

### API Key Storage
- External API keys (Claude, ElevenLabs, etc.) must be:
  - Stored in environment variables
  - Never exposed to frontend
  - Rotated regularly
  - Monitored for unusual usage

---

## Testing Requirements

### Backend Tests Required

1. **Unit Tests**:
   - Input validation for all endpoints
   - Error handling
   - Business logic

2. **Integration Tests**:
   - Database operations
   - External API calls (mocked)
   - Authentication flows

3. **End-to-End Tests**:
   - Complete user flows (signup → onboarding → track bill → generate brief)
   - Error scenarios
   - Rate limiting

4. **Performance Tests**:
   - Load testing (1000 concurrent users)
   - Database query optimization
   - Caching effectiveness

### Frontend Tests Required

1. **Component Tests**:
   - All UI components render correctly
   - User interactions work
   - Form validation

2. **Integration Tests**:
   - API calls succeed/fail gracefully
   - State management
   - Navigation flows

3. **E2E Tests**:
   - Critical user paths
   - Error scenarios
   - Offline behavior

---

## Appendix A: Database Schema Recommendations

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),  -- NULL for OAuth-only users
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  zip_code VARCHAR(5),
  city VARCHAR(100),
  state VARCHAR(2),
  congressional_district VARCHAR(10),
  profile_image_url VARCHAR(500),
  email_verified BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

### User Preferences Table
```sql
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  policy_interests TEXT[] DEFAULT '{}',
  briefing_time TIME DEFAULT '08:00',
  briefing_days TEXT[] DEFAULT '{monday,tuesday,wednesday,thursday,friday}',
  playback_speed DECIMAL(3,2) DEFAULT 1.0,
  autoplay BOOLEAN DEFAULT FALSE,
  email_notifications BOOLEAN DEFAULT TRUE,
  bill_update_notifications BOOLEAN DEFAULT TRUE,
  weekly_summary_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Tracked Bills Table
```sql
CREATE TABLE tracked_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bill_id VARCHAR(50) NOT NULL,
  congress INTEGER NOT NULL,
  bill_type VARCHAR(10) NOT NULL,
  bill_number VARCHAR(10) NOT NULL,
  title TEXT,
  tracked_at TIMESTAMP DEFAULT NOW(),
  last_checked TIMESTAMP DEFAULT NOW(),
  has_new_activity BOOLEAN DEFAULT FALSE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  notes TEXT,
  UNIQUE(user_id, bill_id)
);

CREATE INDEX idx_tracked_bills_user ON tracked_bills(user_id);
CREATE INDEX idx_tracked_bills_new_activity ON tracked_bills(user_id, has_new_activity);
```

### Briefs Table
```sql
CREATE TABLE briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('daily', 'weekly')),
  title VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  duration INTEGER,  -- seconds
  audio_url VARCHAR(500),
  script_url VARCHAR(500),
  script TEXT,
  status VARCHAR(20) DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
  listened BOOLEAN DEFAULT FALSE,
  listened_at TIMESTAMP,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  generated_at TIMESTAMP,
  UNIQUE(user_id, type, date)
);

CREATE INDEX idx_briefs_user_type ON briefs(user_id, type, date DESC);
CREATE INDEX idx_briefs_status ON briefs(user_id, status);
```

### Chat Sessions Table
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bill_id VARCHAR(50) NOT NULL,
  bill_title TEXT,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, deleted_at);
CREATE INDEX idx_chat_sessions_bill ON chat_sessions(bill_id);
```

### Chat Messages Table
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB,  -- Array of {section, text, relevance}
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);
```

---

## Appendix B: API Cost Estimates

### Per User Per Month

**Assumptions**:
- 20 daily briefs per month (weekdays)
- 4 weekly briefs per month
- 50 chat messages per month
- 100 news searches per month

**Costs**:
- Claude (script generation): 20 × $0.15 + 4 × $0.30 = $4.20
- ElevenLabs (audio): 20 × $0.29 + 4 × $0.58 = $8.12
- Cerebras (chat): 50 × $0.01 = $0.50
- Exa.ai (news): 100 × $0.01 = $1.00
- Vultr storage: ~$0.50
- **Total**: ~$14.32 per active user per month

**With 1000 users**: ~$14,320/month
**With 10,000 users**: ~$143,200/month

**Optimization opportunities**:
- Cache news searches (share across users with similar interests)
- Batch brief generation
- Compress audio files
- CDN for audio delivery (included in Vultr estimate)

---

## Changelog

**Version 1.0** (2025-01-16)
- Initial specification
- All 9 API areas documented
- Complete request/response schemas
- Error codes and validation rules
- Database schema recommendations
