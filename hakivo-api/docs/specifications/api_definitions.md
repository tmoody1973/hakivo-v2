# API Definitions

## Authentication Endpoints

### POST /auth/register

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd",
  "firstName": "John",
  "lastName": "Doe",
  "zipCode": "20001"
}
```

**Response (201):**
```json
{
  "userId": "usr_123abc",
  "email": "user@example.com",
  "emailVerificationSent": true
}
```

**Validation:**
- email: valid email format, max 255 chars, unique
- password: min 8 chars, contains uppercase, lowercase, number, special char
- firstName: 1-100 chars
- lastName: 1-100 chars
- zipCode: 5-digit US zip code

### POST /auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ssw0rd"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "ref_abc123...",
  "expiresIn": 3600,
  "user": {
    "id": "usr_123abc",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": true
  }
}
```

**Validation:**
- email: required, valid email format
- password: required, min 1 char

### POST /auth/refresh

**Request:**
```json
{
  "refreshToken": "ref_abc123..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "ref_xyz789...",
  "expiresIn": 3600
}
```

**Validation:**
- refreshToken: required, valid token

## User Endpoints

### GET /user/profile

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Response (200):**
```json
{
  "id": "usr_123abc",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "zipCode": "20001",
  "city": "Washington",
  "congressionalDistrict": "DC-AL",
  "emailVerified": true,
  "onboardingCompleted": true,
  "createdAt": 1640000000000
}
```

### PUT /user/preferences

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Request:**
```json
{
  "policyInterests": ["Environment", "Health", "Education"],
  "briefingTime": "08:00",
  "briefingDays": ["Monday", "Wednesday", "Friday"],
  "playbackSpeed": 1.25,
  "autoplay": true,
  "emailNotifications": true
}
```

**Response (200):**
```json
{
  "success": true,
  "preferences": {
    "policyInterests": ["Environment", "Health", "Education"],
    "briefingTime": "08:00",
    "briefingDays": ["Monday", "Wednesday", "Friday"],
    "playbackSpeed": 1.25,
    "autoplay": true,
    "emailNotifications": true
  }
}
```

**Validation:**
- policyInterests: array of 1-12 strings from allowed categories
- briefingTime: HH:MM format
- briefingDays: array of weekday names
- playbackSpeed: 0.75-2.0
- autoplay: boolean
- emailNotifications: boolean

## Bills Endpoints

### GET /bills/search

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Query Parameters:**
```
?q=climate&congress=118&type=hr&status=introduced&page=1&limit=20
```

**Response (200):**
```json
{
  "bills": [
    {
      "billId": "hr1234-118",
      "title": "Climate Action Act of 2024",
      "congress": 118,
      "type": "hr",
      "number": 1234,
      "latestAction": {
        "date": "2024-01-15",
        "text": "Referred to Committee on Energy"
      },
      "sponsor": {
        "name": "Rep. Smith, Jane",
        "state": "CA",
        "party": "D"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "hasMore": true
  }
}
```

**Validation:**
- q: optional, max 500 chars
- congress: optional, 118-119
- type: optional, hr|s|hjres|sjres|hconres|sconres|hres|sres
- chamber: optional, house|senate
- status: optional, introduced|passed_house|passed_senate|enacted
- policyArea: optional, valid policy area name
- page: min 1, default 1
- limit: 1-100, default 20

### POST /bills/track

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Request:**
```json
{
  "billId": "hr1234-118",
  "title": "Climate Action Act of 2024",
  "congress": 118,
  "type": "hr",
  "number": 1234
}
```

**Response (201):**
```json
{
  "success": true,
  "trackedBill": {
    "id": "track_abc123",
    "billId": "hr1234-118",
    "title": "Climate Action Act of 2024",
    "addedAt": 1640000000000
  }
}
```

**Validation:**
- billId: required, valid format
- title: required, max 500 chars
- congress: required, 118-119
- type: required, valid bill type
- number: required, positive integer
- User must not exceed 100 tracked bills

## Briefs Endpoints

### POST /briefs/generate

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Request:**
```json
{
  "type": "daily"
}
```

**Response (202):**
```json
{
  "briefId": "brief_abc123",
  "status": "pending",
  "estimatedCompletion": 180
}
```

**Validation:**
- type: required, daily|weekly

### GET /briefs/:briefId/status

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Response (200):**
```json
{
  "briefId": "brief_abc123",
  "status": "completed",
  "audioUrl": "https://cdn.hakivo.com/briefs/2024/01/15/brief_abc123.mp3",
  "duration": 540,
  "title": "Your Daily Brief - January 15, 2024",
  "createdAt": 1640000000000,
  "completedAt": 1640000180000
}
```

**Validation:**
- briefId: must belong to authenticated user

## Chat Endpoints

### POST /chat/sessions

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Request:**
```json
{
  "billId": "hr1234-118"
}
```

**Response (201):**
```json
{
  "sessionId": "chat_abc123",
  "billId": "hr1234-118",
  "createdAt": 1640000000000
}
```

**Validation:**
- billId: required, valid format

### POST /chat/sessions/:sessionId/messages

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Request:**
```json
{
  "content": "What are the key provisions of this bill?"
}
```

**Response (200):**
```json
{
  "messageId": "msg_abc123",
  "role": "assistant",
  "content": "The bill contains three key provisions: 1) Establishes a carbon tax...",
  "citations": [
    {
      "section": "Section 2(a)",
      "text": "There is hereby imposed a tax on..."
    }
  ],
  "createdAt": 1640000000000
}
```

**Validation:**
- content: required, 1-5000 chars
- sessionId: must belong to authenticated user

## Dashboard Endpoints

### GET /dashboard

**Headers:**
```
Authorization: Bearer eyJhbGc...
```

**Response (200):**
```json
{
  "upcomingBriefs": {
    "nextGeneration": "2024-01-16T08:00:00Z",
    "schedule": ["Monday", "Wednesday", "Friday"]
  },
  "recentBriefs": [
    {
      "briefId": "brief_abc123",
      "title": "Your Daily Brief - January 15",
      "date": "2024-01-15",
      "duration": 540,
      "listened": true,
      "progress": 100
    }
  ],
  "trackedBills": {
    "total": 12,
    "recentActivity": [
      {
        "billId": "hr1234-118",
        "title": "Climate Action Act",
        "lastAction": "Passed House",
        "lastActionDate": "2024-01-14"
      }
    ]
  },
  "newsHighlights": [
    {
      "title": "Senate Votes on Climate Bill",
      "url": "https://example.com/article",
      "publishedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "latestActions": [
    {
      "billId": "hr1234-118",
      "title": "Climate Action Act of 2024",
      "type": "hr",
      "number": 1234,
      "congress": 118,
      "latestAction": {
        "date": "2024-01-15",
        "text": "Passed House by vote of 245-180",
        "actionCode": "H12410"
      },
      "sponsor": {
        "name": "Rep. Smith, Jane",
        "state": "CA",
        "party": "D"
      },
      "policyArea": "Environmental Protection"
    },
    {
      "billId": "s5678-118",
      "title": "Healthcare Access Improvement Act",
      "type": "s",
      "number": 5678,
      "congress": 118,
      "latestAction": {
        "date": "2024-01-15",
        "text": "Signed by President",
        "actionCode": "E30000"
      },
      "sponsor": {
        "name": "Sen. Johnson, Robert",
        "state": "NY",
        "party": "D"
      },
      "policyArea": "Health"
    }
  ],
  "statistics": {
    "totalBriefs": 45,
    "totalListenTime": 18000,
    "completionRate": 0.78,
    "activeInterests": ["Environment", "Health"],
    "trackedBillsCount": 12
  },
  "recommendations": {
    "bills": ["hr5678-118", "s9012-118"],
    "topics": ["Renewable Energy", "Healthcare Reform"]
  }
}
```
