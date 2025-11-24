# CRITICAL: Cloudflare Workers - Correct Patterns for Raindrop

## 🚨 THE RULE: NEVER USE `process.env` IN CLOUDFLARE WORKERS

**Cloudflare Workers DO NOT support `process.env`** - using it causes Error 1101 "Worker threw exception"

---

## The Bug We Fixed (Nov 2024)

### Root Causes:
1. **Invalid CORS**: `cors({ origin: '*', credentials: true })` → crashes
2. **process.env usage**: Any `process.env.VARIABLE` → crashes at Worker initialization
3. **Module-level process.env**: Even in unused files like `cors-config.ts` → crashes

### Symptoms:
- Error 1101: Worker threw exception
- Services deploy successfully but crash at runtime
- No error logs visible (Workers fail during initialization)

---

## ✅ CORRECT PATTERNS

### 1. Environment Variables

#### ❌ WRONG (Node.js pattern):
```typescript
const apiKey = process.env.API_KEY;
const jwtSecret = process.env.JWT_SECRET;
```

#### ✅ CORRECT (Cloudflare Workers):
```typescript
// In Service classes (extends Service<Env>):
const apiKey = this.env.API_KEY;

// In Hono route handlers:
const jwtSecret = c.env.JWT_SECRET;

// Pass as parameter pattern:
async function verifyAuth(authHeader: string, jwtSecret: string) {
  // Use jwtSecret parameter, not process.env
  const { jwtVerify } = await import('jose');
  const secret = new TextEncoder().encode(jwtSecret);
  const { payload } = await jwtVerify(token, secret);
  return { userId: payload.userId };
}

// Caller:
const auth = await verifyAuth(authHeader, c.env.JWT_SECRET);
```

### 2. CORS Configuration

#### ❌ WRONG (crashes):
```typescript
import { cors } from 'hono/cors';

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true  // ❌ INVALID with wildcard origin
}));
```

#### ✅ CORRECT (safe defaults):
```typescript
import { cors } from 'hono/cors';

app.use('*', cors()); // Uses safe defaults
```

### 3. Service Structure

```typescript
import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('*', cors());

async function verifyAuth(authHeader: string | undefined, jwtSecret: string) {
  // JWT verification with parameter
}

async function requireAuth(c: any): Promise<{ userId: string } | Response> {
  const authHeader = c.req.header('Authorization');
  const auth = await verifyAuth(authHeader, c.env.JWT_SECRET); // ✅ Pass from c.env

  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return auth;
}

app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'my-service' });
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env); // ✅ Pass this.env to Hono
  }
}
```

---

## Environment Variables Checklist

### Step 1: Declare in `raindrop.manifest`
```hcl
env "JWT_SECRET" {
  secret = true
}

env "API_KEY_NAME" {
  secret = true
}
```

### Step 2: Regenerate TypeScript types
```bash
raindrop build generate
```

This creates/updates `src/SERVICE_NAME/raindrop.gen.ts` with the Env type:
```typescript
export interface Env {
  JWT_SECRET: string;
  API_KEY_NAME: string;
  // ...
}
```

### Step 3: Set values (production)
```bash
raindrop env set JWT_SECRET "your-secret-value"
raindrop env set API_KEY_NAME "your-api-key"
```

---

## Services Fixed (Reference)

### HTTP Services (CORS + JWT fixes):
- ✅ `src/bills-service/index.ts`
- ✅ `src/chat-service/index.ts`
- ✅ `src/briefs-service/index.ts`
- ✅ `src/dashboard-service/index.ts`

### Client Services (process.env → this.env):
- ✅ `src/cerebras-client/index.ts`
- ✅ `src/claude-client/index.ts`
- ✅ `src/congress-api-client/index.ts`
- ✅ `src/elevenlabs-client/index.ts`
- ✅ `src/vultr-storage-client/index.ts`

### Files Removed:
- ❌ `src/_app/cors-config.ts` (had module-level process.env)
- ❌ `src/inngest-service/` (build failures)

---

## Verification Steps

### 1. Build Check
```bash
npm run build
```
Should show: `Build Summary: X/X handlers built successfully` with 0 TypeScript errors

### 2. Deploy
```bash
npm run restart
```

### 3. Test Runtime
```bash
curl https://your-service-url.lmapp.run/health
```
Should return JSON like `{"status":"ok"}`, NOT Error 1101

---

## Why This Happens

**Node.js vs Cloudflare Workers:**
- **Node.js**: Provides `process.env` object for environment variables
- **Cloudflare Workers**: Uses bindings through `env` object instead
- Raindrop Framework runs on Cloudflare Workers
- Code trying to access `process.env` crashes because it doesn't exist

**The Official Raindrop Pattern:**
- Services: `this.env.VARIABLE_NAME`
- Hono handlers: `c.env.VARIABLE_NAME`
- Never: `process.env.VARIABLE_NAME`

---

## Official Documentation

Raindrop Services pattern (NO process.env usage):
https://docs.liquidmetal.ai/reference/services/

Example from official docs:
```typescript
export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    // ✅ Use this.env, not process.env
    const result = await this.env.APP_DB.prepare('SELECT ...').all();
    return new Response(JSON.stringify(result));
  }
}
```

---

**Last Updated:** November 23, 2024
**Issue:** Fixed Error 1101 across all services
**Build Status:** 23/23 handlers building successfully
