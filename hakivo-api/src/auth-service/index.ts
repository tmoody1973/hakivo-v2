import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import * as jose from 'jose';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { WorkOS } from '@workos-inc/node';
import { USER_INTERESTS, getInterestNames } from '../config/user-interests';

// State abbreviation to full name mapping
const STATE_ABBREVIATIONS: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia', AS: 'American Samoa', GU: 'Guam', MP: 'Northern Mariana Islands',
  PR: 'Puerto Rico', VI: 'Virgin Islands'
};

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  zipCode: z.string().regex(/^\d{5}$/).optional()
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const RefreshSchema = z.object({
  refreshToken: z.string()
});

const PasswordResetRequestSchema = z.object({
  email: z.string().email()
});

const PasswordResetSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8)
});

const VerifyEmailSchema = z.object({
  token: z.string()
});

const OnboardingSchema = z.object({
  interests: z.array(z.string()).min(1, 'At least one interest required'),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  zipCode: z.string().regex(/^\d{5}$/).optional(),
  city: z.string().optional()
});

const UpdateInterestsSchema = z.object({
  interests: z.array(z.string()).min(1, 'At least one interest required')
});

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
// Manual CORS middleware - Hono's CORS middleware was not setting Access-Control-Allow-Origin header
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || '';
  const allowedOrigins = ['http://localhost:3000', 'https://hakivo-v2.netlify.app'];

  // Set CORS headers on all requests
  if (allowedOrigins.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
  } else {
    // Allow all origins temporarily for testing
    c.header('Access-Control-Allow-Origin', '*');
  }
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  c.header('Access-Control-Expose-Headers', 'Content-Type, Authorization');
  c.header('Access-Control-Max-Age', '600');

  // Handle preflight OPTIONS requests
  if (c.req.method === 'OPTIONS') {
    return c.text('', 200);
  }

  await next();
});

/**
 * Generate JWT access token
 */
async function generateAccessToken(userId: string, email: string, env: any): Promise<string> {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }

  const secret = new TextEncoder().encode(jwtSecret);

  const token = await new jose.SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m') // Short-lived access token
    .sign(secret);

  return token;
}

/**
 * Generate refresh token
 */
async function generateRefreshToken(
  db: any,
  userId: string
): Promise<string> {
  // Generate random token
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(tokenBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Hash token for storage
  const tokenHash = await bcrypt.hash(token, 10);

  // Store in database (valid for 30 days)
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const id = crypto.randomUUID();

  await db
    .prepare(
      'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, userId, tokenHash, expiresAt, Date.now())
    .run();

  return token;
}

/**
 * Generate email verification token
 */
async function generateVerificationToken(
  db: any,
  userId: string
): Promise<string> {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(tokenBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const id = crypto.randomUUID();

  await db
    .prepare(
      'INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(id, userId, tokenHash, expiresAt, 0, Date.now())
    .run();

  return token;
}

/**
 * Generate password reset token
 */
async function generatePasswordResetToken(
  db: any,
  userId: string
): Promise<string> {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(tokenBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const tokenHash = await bcrypt.hash(token, 10);
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
  const id = crypto.randomUUID();

  await db
    .prepare(
      'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(id, userId, tokenHash, expiresAt, 0, Date.now())
    .run();

  return token;
}

/**
 * Verify JWT token
 */
async function verifyAccessToken(token: string, env: any): Promise<{ userId: string; email: string } | null> {
  try {
    console.log('[verifyAccessToken] Starting token verification');
    console.log('[verifyAccessToken] Token (first 50 chars):', token?.substring(0, 50));

    const jwtSecret = env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[verifyAccessToken] JWT_SECRET not configured');
      throw new Error('JWT_SECRET not configured');
    }

    console.log('[verifyAccessToken] JWT_SECRET exists:', !!jwtSecret);
    console.log('[verifyAccessToken] JWT_SECRET length:', jwtSecret.length);

    const secret = new TextEncoder().encode(jwtSecret);
    console.log('[verifyAccessToken] About to verify JWT...');

    const { payload } = await jose.jwtVerify(token, secret);

    console.log('[verifyAccessToken] JWT verified successfully');
    console.log('[verifyAccessToken] Payload:', payload);

    if (typeof payload.userId !== 'string' || typeof payload.email !== 'string') {
      console.error('[verifyAccessToken] Invalid payload shape:', payload);
      return null;
    }

    console.log('[verifyAccessToken] Token is valid, returning user info');
    return {
      userId: payload.userId,
      email: payload.email
    };
  } catch (error) {
    console.error('[verifyAccessToken] Error verifying token:', error);
    console.error('[verifyAccessToken] Error name:', error instanceof Error ? error.name : 'unknown');
    console.error('[verifyAccessToken] Error message:', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}

/**
 * Check rate limit
 */
async function checkRateLimit(
  db: any,
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now();
  const resetAt = now + windowMs;

  const result = await db
    .prepare('SELECT count, reset_at FROM rate_limits WHERE key = ?')
    .bind(key)
    .first();

  if (!result) {
    // Create new rate limit entry
    await db
      .prepare('INSERT INTO rate_limits (key, count, reset_at) VALUES (?, ?, ?)')
      .bind(key, 1, resetAt)
      .run();
    return true;
  }

  const count = result.count as number;
  const storedResetAt = result.reset_at as number;

  // Reset if window expired
  if (now > storedResetAt) {
    await db
      .prepare('UPDATE rate_limits SET count = ?, reset_at = ? WHERE key = ?')
      .bind(1, resetAt, key)
      .run();
    return true;
  }

  // Check limit
  if (count >= maxRequests) {
    return false;
  }

  // Increment counter
  await db
    .prepare('UPDATE rate_limits SET count = ? WHERE key = ?')
    .bind(count + 1, key)
    .run();

  return true;
}

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() });
});

/**
 * POST /auth/register
 * Register a new user account
 */
app.post('/auth/register', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Rate limiting: 5 registrations per IP per hour
    const clientIP = c.req.header('cf-connecting-ip') || 'unknown';
    const rateLimitKey = `register:${clientIP}`;
    const allowed = await checkRateLimit(db, rateLimitKey, 5, 60 * 60 * 1000);

    if (!allowed) {
      return c.json({ error: 'Too many registration attempts. Please try again later.' }, 429);
    }

    // Validate input
    const body = await c.req.json();
    const validation = RegisterSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: 'Invalid input', details: validation.error.errors }, 400);
    }

    const { email, password, firstName, lastName, zipCode } = validation.data;

    // Check if user already exists
    const existingUser = await c.env.USER_SERVICE.getUserByEmail(email);
    if (existingUser) {
      return c.json({ error: 'User with this email already exists' }, 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user ID
    const userId = crypto.randomUUID();

    // Insert user with password hash
    const now = Date.now();
    await db
      .prepare(
        `INSERT INTO users (
          id, email, password_hash, first_name, last_name, zip_code,
          email_verified, onboarding_completed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        userId,
        email,
        passwordHash,
        firstName,
        lastName,
        zipCode || null,
        0,
        0,
        now,
        now
      )
      .run();

    // Create user via user-service to populate district info
    await c.env.USER_SERVICE.createUser({
      id: userId,
      email,
      firstName,
      lastName,
      zipCode
    });

    // Generate verification token
    const verificationToken = await generateVerificationToken(db, userId);

    // TODO: Send verification email
    console.log(`✓ User registered: ${email} (verification token: ${verificationToken})`);

    // Generate tokens
    const accessToken = await generateAccessToken(userId, email, c.env);
    const refreshToken = await generateRefreshToken(db, userId);

    return c.json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email,
        firstName,
        lastName,
        emailVerified: false,
        onboardingCompleted: false
      }
    }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({
      error: 'Registration failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /auth/login
 * Login with email and password
 */
app.post('/auth/login', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Rate limiting: 10 login attempts per IP per 15 minutes
    const clientIP = c.req.header('cf-connecting-ip') || 'unknown';
    const rateLimitKey = `login:${clientIP}`;
    const allowed = await checkRateLimit(db, rateLimitKey, 10, 15 * 60 * 1000);

    if (!allowed) {
      return c.json({ error: 'Too many login attempts. Please try again later.' }, 429);
    }

    // Validate input
    const body = await c.req.json();
    const validation = LoginSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: 'Invalid input', details: validation.error.errors }, 400);
    }

    const { email, password } = validation.data;

    // Get user from database
    const result = await db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first();

    if (!result || !result.password_hash) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, result.password_hash as string);

    if (!passwordValid) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const userId = result.id as string;

    // Generate tokens
    const accessToken = await generateAccessToken(userId, email, c.env);
    const refreshToken = await generateRefreshToken(db, userId);

    console.log(`✓ User logged in: ${email}`);

    return c.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email: result.email as string,
        firstName: result.first_name as string,
        lastName: result.last_name as string,
        emailVerified: Boolean(result.email_verified),
        onboardingCompleted: Boolean(result.onboarding_completed)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({
      error: 'Login failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 * Accepts refresh token from query parameter or request body (to avoid CORS preflight)
 */
app.post('/auth/refresh', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Get refresh token from query parameter (preferred to avoid CORS preflight) or body
    const refreshTokenFromQuery = c.req.query('refreshToken');
    let refreshToken = refreshTokenFromQuery;

    // If not in query, try to get from body
    if (!refreshToken) {
      try {
        const body = await c.req.json();
        const validation = RefreshSchema.safeParse(body);

        if (!validation.success) {
          return c.json({ error: 'Invalid input', details: validation.error.errors }, 400);
        }

        refreshToken = validation.data.refreshToken;
      } catch (e) {
        return c.json({ error: 'No refresh token provided' }, 400);
      }
    }

    if (!refreshToken) {
      return c.json({ error: 'No refresh token provided' }, 400);
    }

    // Get all refresh tokens (we need to check hash)
    const tokens = await db
      .prepare('SELECT * FROM refresh_tokens WHERE expires_at > ?')
      .bind(Date.now())
      .all();

    if (!tokens.results || tokens.results.length === 0) {
      return c.json({ error: 'Invalid or expired refresh token' }, 401);
    }

    // Find matching token by comparing hashes
    let matchedToken = null;
    for (const tokenRecord of tokens.results) {
      const isMatch = await bcrypt.compare(refreshToken, tokenRecord.token_hash as string);
      if (isMatch) {
        matchedToken = tokenRecord;
        break;
      }
    }

    if (!matchedToken) {
      return c.json({ error: 'Invalid or expired refresh token' }, 401);
    }

    const userId = matchedToken.user_id as string;

    // Get user email
    const user = await db
      .prepare('SELECT email FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Generate new access token
    const accessToken = await generateAccessToken(userId, user.email as string, c.env);

    console.log(`✓ Token refreshed for user: ${userId}`);

    return c.json({
      success: true,
      accessToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json({
      error: 'Token refresh failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /auth/logout
 * Logout and invalidate refresh token
 */
app.post('/auth/logout', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Get authorization header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = await verifyAccessToken(token, c.env);

    if (!payload) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    // Delete all refresh tokens for this user
    await db
      .prepare('DELETE FROM refresh_tokens WHERE user_id = ?')
      .bind(payload.userId)
      .run();

    console.log(`✓ User logged out: ${payload.userId}`);

    return c.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({
      error: 'Logout failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /auth/verify-email
 * Verify email address with token
 */
app.post('/auth/verify-email', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Validate input
    const body = await c.req.json();
    const validation = VerifyEmailSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: 'Invalid input', details: validation.error.errors }, 400);
    }

    const { token } = validation.data;

    // Get all verification tokens
    const tokens = await db
      .prepare('SELECT * FROM email_verification_tokens WHERE used = ? AND expires_at > ?')
      .bind(0, Date.now())
      .all();

    if (!tokens.results || tokens.results.length === 0) {
      return c.json({ error: 'Invalid or expired verification token' }, 400);
    }

    // Find matching token
    let matchedToken = null;
    for (const tokenRecord of tokens.results) {
      const isMatch = await bcrypt.compare(token, tokenRecord.token_hash as string);
      if (isMatch) {
        matchedToken = tokenRecord;
        break;
      }
    }

    if (!matchedToken) {
      return c.json({ error: 'Invalid or expired verification token' }, 400);
    }

    const userId = matchedToken.user_id as string;

    // Mark email as verified
    await db
      .prepare('UPDATE users SET email_verified = ?, updated_at = ? WHERE id = ?')
      .bind(1, Date.now(), userId)
      .run();

    // Mark token as used
    await db
      .prepare('UPDATE email_verification_tokens SET used = ? WHERE id = ?')
      .bind(1, matchedToken.id)
      .run();

    console.log(`✓ Email verified for user: ${userId}`);

    return c.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return c.json({
      error: 'Email verification failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /auth/request-password-reset
 * Request password reset token
 */
app.post('/auth/request-password-reset', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Rate limiting
    const clientIP = c.req.header('cf-connecting-ip') || 'unknown';
    const rateLimitKey = `password-reset:${clientIP}`;
    const allowed = await checkRateLimit(db, rateLimitKey, 3, 60 * 60 * 1000);

    if (!allowed) {
      return c.json({ error: 'Too many password reset requests. Please try again later.' }, 429);
    }

    // Validate input
    const body = await c.req.json();
    const validation = PasswordResetRequestSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: 'Invalid input', details: validation.error.errors }, 400);
    }

    const { email } = validation.data;

    // Get user
    const user = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first();

    // Don't reveal if user exists (security best practice)
    if (!user) {
      return c.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    const userId = user.id as string;

    // Generate reset token
    const resetToken = await generatePasswordResetToken(db, userId);

    // TODO: Send reset email
    console.log(`✓ Password reset requested: ${email} (token: ${resetToken})`);

    return c.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return c.json({
      error: 'Password reset request failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /auth/reset-password
 * Reset password with token
 */
app.post('/auth/reset-password', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Validate input
    const body = await c.req.json();
    const validation = PasswordResetSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: 'Invalid input', details: validation.error.errors }, 400);
    }

    const { token, newPassword } = validation.data;

    // Get all reset tokens
    const tokens = await db
      .prepare('SELECT * FROM password_reset_tokens WHERE used = ? AND expires_at > ?')
      .bind(0, Date.now())
      .all();

    if (!tokens.results || tokens.results.length === 0) {
      return c.json({ error: 'Invalid or expired reset token' }, 400);
    }

    // Find matching token
    let matchedToken = null;
    for (const tokenRecord of tokens.results) {
      const isMatch = await bcrypt.compare(token, tokenRecord.token_hash as string);
      if (isMatch) {
        matchedToken = tokenRecord;
        break;
      }
    }

    if (!matchedToken) {
      return c.json({ error: 'Invalid or expired reset token' }, 400);
    }

    const userId = matchedToken.user_id as string;

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .bind(passwordHash, Date.now(), userId)
      .run();

    // Mark token as used
    await db
      .prepare('UPDATE password_reset_tokens SET used = ? WHERE id = ?')
      .bind(1, matchedToken.id)
      .run();

    // Invalidate all refresh tokens
    await db
      .prepare('DELETE FROM refresh_tokens WHERE user_id = ?')
      .bind(userId)
      .run();

    console.log(`✓ Password reset for user: ${userId}`);

    return c.json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return c.json({
      error: 'Password reset failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /auth/me
 * Get current user profile (requires auth)
 */
app.get('/auth/me', async (c) => {
  try {
    // Get authorization header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    const token = authHeader.substring(7);
    const payload = await verifyAccessToken(token, c.env);

    if (!payload) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Get full user data from user-service
    const user = await c.env.USER_SERVICE.getUserById(payload.userId);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({
      error: 'Failed to get user',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// ============================================================================
// WorkOS AuthKit Integration
// ============================================================================

/**
 * GET /auth/workos/login
 * Redirect to WorkOS AuthKit for authentication
 * Query params:
 *   - mode: 'signup' or 'signin' (default: 'signin')
 *   - force: 'true' to force showing auth screen even if session exists
 */
app.get('/auth/workos/login', async (c) => {
  try {
    const workosApiKey = c.env.WORKOS_API_KEY;
    const workosClientId = c.env.WORKOS_CLIENT_ID;
    const workosRedirectUri = c.env.WORKOS_REDIRECT_URI;

    if (!workosApiKey || !workosClientId || !workosRedirectUri) {
      return c.json({
        error: 'WorkOS configuration missing',
        message: 'WORKOS_API_KEY, WORKOS_CLIENT_ID, and WORKOS_REDIRECT_URI must be set'
      }, 500);
    }

    const workos = new WorkOS(workosApiKey);

    // Check mode (signup vs signin)
    const mode = c.req.query('mode') || 'signin';
    const forceLogin = c.req.query('force') === 'true';

    // Determine screen hint based on mode
    // 'sign-up' shows the create account form
    // 'sign-in' shows the login form
    const screenHint = mode === 'signup' ? 'sign-up' : 'sign-in';

    // Generate authorization URL
    const authorizationUrl = workos.userManagement.getAuthorizationUrl({
      provider: 'authkit',
      clientId: workosClientId,
      redirectUri: workosRedirectUri,
      screenHint,
    });

    console.log(`✓ Redirecting to WorkOS AuthKit (mode: ${mode}, screenHint: ${screenHint}): ${authorizationUrl}`);

    return c.redirect(authorizationUrl);
  } catch (error) {
    console.error('WorkOS login error:', error);
    return c.json({
      error: 'WorkOS login failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /auth/workos/callback
 * Handle WorkOS callback and create user session
 */
app.get('/auth/workos/callback', async (c) => {
  try {
    const db = c.env.APP_DB;
    const workosApiKey = c.env.WORKOS_API_KEY;
    const workosClientId = c.env.WORKOS_CLIENT_ID;

    if (!workosApiKey || !workosClientId) {
      return c.json({
        error: 'WorkOS configuration missing'
      }, 500);
    }

    // Get authorization code from query params
    const code = c.req.query('code');
    if (!code) {
      return c.json({ error: 'Missing authorization code' }, 400);
    }

    const workos = new WorkOS(workosApiKey);

    // Exchange code for user profile
    const authResponse = await workos.userManagement.authenticateWithCode({
      code,
      clientId: workosClientId,
    });

    console.log('✓ WorkOS auth response:', JSON.stringify(authResponse, null, 2));

    const { user, accessToken: workosAccessToken } = authResponse;

    // Extract WorkOS session ID from the access token's 'sid' claim
    let workosSessionId: string | null = null;
    try {
      const decoded = jose.decodeJwt(workosAccessToken);
      workosSessionId = decoded.sid as string;
      console.log('✓ Extracted WorkOS session ID:', workosSessionId);
    } catch (err) {
      console.warn('⚠️ Could not extract session ID from WorkOS token:', err);
    }

    // Check if user exists in database
    let existingUser = await db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(user.email)
      .first();

    console.log('[WorkOS Callback] Existing user check:', {
      email: user.email,
      existingUserFound: !!existingUser,
      onboardingCompleted: existingUser ? existingUser.onboarding_completed : null,
      userId: existingUser ? existingUser.id : null
    });

    let userId: string;

    if (!existingUser) {
      // Create new user from WorkOS profile
      userId = crypto.randomUUID();
      const now = Date.now();

      await db
        .prepare(
          `INSERT INTO users (
            id, email, first_name, last_name, workos_user_id,
            email_verified, onboarding_completed, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          userId,
          user.email,
          user.firstName || '',
          user.lastName || '',
          user.id,
          user.emailVerified ? 1 : 0,
          0,
          now,
          now
        )
        .run();

      console.log(`✓ Created new user from WorkOS: ${user.email}`);
    } else {
      userId = existingUser.id as string;

      // Update WorkOS user ID if not set
      if (!existingUser.workos_user_id) {
        await db
          .prepare('UPDATE users SET workos_user_id = ?, updated_at = ? WHERE id = ?')
          .bind(user.id, Date.now(), userId)
          .run();
      }

      console.log(`✓ Existing user logged in via WorkOS: ${user.email}`);
    }

    // Generate tokens
    const accessToken = await generateAccessToken(userId, user.email, c.env);
    const refreshToken = await generateRefreshToken(db, userId);

    // Store session in session-cache KV
    const sessionId = crypto.randomUUID();
    await c.env.SESSION_CACHE.put(
      `session:${sessionId}`,
      JSON.stringify({
        userId,
        email: user.email,
        workosUserId: user.id,
        workosSessionId, // Store WorkOS session ID for logout
        createdAt: Date.now()
      }),
      { expirationTtl: 30 * 24 * 60 * 60 } // 30 days
    );

    // Return tokens and redirect info
    // In production, you'd redirect to your frontend with tokens in secure cookies
    const onboardingStatus = existingUser ? Boolean(existingUser.onboarding_completed) : false;

    console.log('[WorkOS Callback] Returning user data:', {
      userId,
      email: user.email,
      existingUserFound: !!existingUser,
      rawOnboardingValue: existingUser ? existingUser.onboarding_completed : null,
      onboardingCompleted: onboardingStatus
    });

    return c.json({
      success: true,
      message: 'Authentication successful',
      accessToken,
      refreshToken,
      sessionId,
      workosSessionId, // Return WorkOS session ID to frontend for logout
      user: {
        id: userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
        onboardingCompleted: onboardingStatus
      }
    });
  } catch (error) {
    console.error('WorkOS callback error:', error);
    return c.json({
      error: 'WorkOS callback failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /auth/workos/logout
 * End WorkOS session and revoke all user sessions
 */
app.get('/auth/workos/logout', async (c) => {
  try {
    const workosApiKey = c.env.WORKOS_API_KEY;
    const workosClientId = c.env.WORKOS_CLIENT_ID;

    if (!workosApiKey || !workosClientId) {
      return c.json({ error: 'WorkOS not configured' }, 500);
    }

    const workos = new WorkOS(workosApiKey);

    // Get workosSessionId from query parameter (passed from frontend) OR from cache
    let workosSessionId: string | null = c.req.query('workosSessionId') || null;
    const sessionId = c.req.query('sessionId');

    // If not passed directly, try to get it from cache
    if (!workosSessionId && sessionId) {
      // Retrieve session from cache to get WorkOS session ID
      const sessionData = await c.env.SESSION_CACHE.get(`session:${sessionId}`);

      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          workosSessionId = session.workosSessionId;
          console.log('✓ Retrieved WorkOS session ID from cache:', workosSessionId);
        } catch (err) {
          console.warn('⚠️ Could not parse session data:', err);
        }
      }

      // Delete local session from KV cache
      await c.env.SESSION_CACHE.delete(`session:${sessionId}`);
      console.log(`✓ Deleted local session from cache: ${sessionId}`);
    } else if (workosSessionId) {
      console.log('✓ Using WorkOS session ID from query parameter');

      // Still clean up local session if provided
      if (sessionId) {
        await c.env.SESSION_CACHE.delete(`session:${sessionId}`);
        console.log(`✓ Deleted local session from cache: ${sessionId}`);
      }
    }

    // Generate logout redirect URL
    let logoutUrl: string;

    if (workosSessionId) {
      // Use SDK method to generate proper logout URL with session ID
      // This will end the WorkOS session and redirect to the configured logout URI
      logoutUrl = workos.userManagement.getLogoutUrl({ sessionId: workosSessionId });
      console.log(`✓ Generated WorkOS logout URL with session ID: ${workosSessionId}`);
    } else {
      // No session ID available - redirect to landing page
      const appUrl = 'https://hakivo-v2.netlify.app';
      logoutUrl = appUrl; // Redirect to home/landing page
      console.log(`⚠️ No WorkOS session ID found, redirecting to landing page`);
    }

    console.log(`✓ Redirecting to: ${logoutUrl}`);

    return c.redirect(logoutUrl);
  } catch (error) {
    console.error('WorkOS logout error:', error);

    // Fallback: redirect to home page if logout fails
    const fallbackUrl = 'https://hakivo-v2.netlify.app';

    console.log(`⚠️ Logout failed, redirecting to fallback: ${fallbackUrl}`);
    return c.redirect(fallbackUrl);
  }
});

/**
 * GET /auth/onboarding
 * Get available interest categories for onboarding
 */
app.get('/auth/onboarding', async (c) => {
  try {
    // Return all available interest categories
    const interests = USER_INTERESTS.map(interest => ({
      name: interest.interest,
      policyAreas: interest.policy_areas,
      keywords: interest.keywords
    }));

    return c.json({
      success: true,
      interests
    });
  } catch (error) {
    console.error('Get onboarding interests error:', error);
    return c.json({
      error: 'Failed to get interests',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /auth/onboarding
 * Complete onboarding with user interests and optional personal info
 * Accepts token via query parameter to avoid CORS preflight (Cloudflare blocks OPTIONS)
 */
app.post('/auth/onboarding', async (c) => {
  try {
    // Get token from query parameter (to avoid CORS preflight)
    const tokenFromQuery = c.req.query('token');

    // Also check Authorization header as fallback
    const authHeader = c.req.header('Authorization');
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const token = tokenFromQuery || tokenFromHeader;

    if (!token) {
      return c.json({ error: 'Unauthorized - No token provided' }, 401);
    }

    const user = await verifyAccessToken(token, c.env);

    if (!user) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    // Parse request body (handle both text/plain and application/json Content-Type)
    const bodyText = await c.req.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      return c.json({ error: 'Invalid JSON in request body' }, 400);
    }

    const validation = OnboardingSchema.safeParse(body);

    if (!validation.success) {
      return c.json({
        error: 'Validation failed',
        details: validation.error.issues
      }, 400);
    }

    const { interests, firstName, lastName, zipCode, city } = validation.data;

    // Validate interests against available categories
    const validInterestNames = getInterestNames();
    const invalidInterests = interests.filter(i => !validInterestNames.includes(i));

    if (invalidInterests.length > 0) {
      return c.json({
        error: 'Invalid interests',
        invalidInterests,
        validInterests: validInterestNames
      }, 400);
    }

    // Variables to store district and representative information
    let stateCode: string | null = null;
    let districtNumber: number | null = null;
    let representatives: any[] = [];

    // Update user personal info if provided
    const db = c.env.APP_DB;

    // Look up district information first if zipCode is provided
    if (zipCode) {
      try {
        const districtInfo = await c.env.GEOCODIO_CLIENT.lookupDistrict(zipCode);
        if (districtInfo) {

            // Store state and district for representatives lookup
            stateCode = districtInfo.state;
            districtNumber = parseInt(districtInfo.district, 10);

            console.log(`✓ Geocodio lookup: ${zipCode} → ${districtInfo.state}-${districtInfo.district}`);

            // Convert state abbreviation to full name for database query
            const stateFullName = STATE_ABBREVIATIONS[stateCode] || stateCode;
            console.log(`✓ Converting state: ${stateCode} → ${stateFullName}`);

            // Query members table to find user's representatives
            // Get 2 senators (district is NULL)
            const senators = await db
              .prepare('SELECT * FROM members WHERE state = ? AND district IS NULL AND current_member = 1 LIMIT 2')
              .bind(stateFullName)
              .all();

            // Get 1 house representative
            const houseRep = await db
              .prepare('SELECT * FROM members WHERE state = ? AND district = ? AND current_member = 1 LIMIT 1')
              .bind(stateFullName, districtNumber)
              .first();

            // Build representatives array
            if (senators.results && senators.results.length > 0) {
              representatives.push(...senators.results.map((sen: any) => ({
                bioguideId: sen.bioguide_id,
                name: `${sen.first_name} ${sen.last_name}`,
                firstName: sen.first_name,
                lastName: sen.last_name,
                party: sen.party,
                state: sen.state,
                chamber: 'Senate',
                district: null,
                imageUrl: sen.image_url,
                officeAddress: sen.office_address,
                phoneNumber: sen.phone_number,
                url: sen.url
              })));
            }

            if (houseRep) {
              representatives.push({
                bioguideId: houseRep.bioguide_id,
                name: `${houseRep.first_name} ${houseRep.last_name}`,
                firstName: houseRep.first_name,
                lastName: houseRep.last_name,
                party: houseRep.party,
                state: houseRep.state,
                chamber: 'House',
                district: houseRep.district,
                imageUrl: houseRep.image_url,
                officeAddress: houseRep.office_address,
                phoneNumber: houseRep.phone_number,
                url: houseRep.url
              });
            }

            console.log(`✓ Found ${representatives.length} representatives for ${stateCode}-${districtNumber}`);
        }
      } catch (error) {
        console.warn('Failed to lookup district:', error);
        // Continue without district info
      }
    }

    // Update users table with personal info, city, zipCode, and congressional district
    const userUpdates: string[] = [];
    const userBinds: any[] = [];

    if (firstName) {
      userUpdates.push('first_name = ?');
      userBinds.push(firstName);
    }
    if (lastName) {
      userUpdates.push('last_name = ?');
      userBinds.push(lastName);
    }
    if (city) {
      userUpdates.push('city = ?');
      userBinds.push(city);
    }
    if (zipCode) {
      userUpdates.push('zip_code = ?');
      userBinds.push(zipCode);
    }
    if (stateCode && districtNumber !== null) {
      userUpdates.push('congressional_district = ?');
      userBinds.push(`${stateCode}-${districtNumber}`);
    }

    if (userUpdates.length > 0) {
      userUpdates.push('updated_at = ?');
      userBinds.push(Date.now());
      userBinds.push(user.userId);

      await db
        .prepare(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`)
        .bind(...userBinds)
        .run();

      console.log(`✓ Updated user info for ${user.userId}:`, { firstName, lastName, city, zipCode, congressionalDistrict: stateCode && districtNumber !== null ? `${stateCode}-${districtNumber}` : null });
    }

    // Update user preferences with interests, state, and district
    // Check if preferences exist
    const existingPrefs = await db
      .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
      .bind(user.userId)
      .first();

    if (existingPrefs) {
      // Update existing preferences
      const updates: string[] = ['policy_interests = ?'];
      const binds: any[] = [JSON.stringify(interests)];

      if (zipCode) {
        updates.push('zipcode = ?');
        binds.push(zipCode);
      }
      if (stateCode) {
        updates.push('state = ?');
        binds.push(stateCode);
      }
      if (districtNumber !== null) {
        updates.push('district = ?');
        binds.push(districtNumber);
      }

      binds.push(user.userId);
      await db
        .prepare(`UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = ?`)
        .bind(...binds)
        .run();
    } else {
      // Create new preferences
      await db
        .prepare(
          `INSERT INTO user_preferences (user_id, policy_interests, zipcode, state, district, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          user.userId,
          JSON.stringify(interests),
          zipCode || null,
          stateCode,
          districtNumber,
          Date.now(),
          Date.now()
        )
        .run();
    }

    // Mark onboarding as completed
    await db
      .prepare('UPDATE users SET onboarding_completed = ?, updated_at = ? WHERE id = ?')
      .bind(1, Date.now(), user.userId)
      .run();

    console.log(`✓ Onboarding completed for user: ${user.userId}`);

    // ==================== GENERATE FIRST DAILY BRIEF ====================
    // Immediately trigger a brief so new users don't have to wait until 7 AM
    try {
      const briefId = crypto.randomUUID();
      const now = Date.now();
      const briefEndDate = new Date();
      const briefStartDate = new Date();
      briefStartDate.setDate(briefStartDate.getDate() - 1); // Last 24 hours

      // Create brief record
      await db
        .prepare(`
          INSERT INTO briefs (
            id, user_id, type, title, start_date, end_date, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          briefId,
          user.userId,
          'daily',
          `Your First Daily Brief - ${briefEndDate.toLocaleDateString()}`,
          briefStartDate.toISOString().split('T')[0],
          briefEndDate.toISOString().split('T')[0],
          'pending',
          now,
          now
        )
        .run();

      // Enqueue brief generation
      await c.env.BRIEF_QUEUE.send({
        briefId,
        userId: user.userId,
        type: 'daily',
        startDate: briefStartDate.toISOString(),
        endDate: briefEndDate.toISOString(),
        requestedAt: now
      });

      console.log(`✓ First daily brief enqueued for new user: ${user.userId} (briefId: ${briefId})`);
    } catch (briefError) {
      // Non-fatal - user can still use the app, brief will come at next scheduled run
      console.error(`⚠️ Failed to enqueue first brief for ${user.userId}:`, briefError);
    }

    return c.json({
      success: true,
      message: 'Onboarding completed successfully',
      interests,
      representatives: representatives.length > 0 ? representatives : undefined,
      district: stateCode && districtNumber !== null ? {
        state: stateCode,
        district: districtNumber,
        congressionalDistrict: `${stateCode}-${districtNumber}`
      } : undefined
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    return c.json({
      error: 'Onboarding failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /auth/settings
 * Get current user preferences
 * Accepts token via query parameter to avoid CORS preflight (Cloudflare blocks OPTIONS)
 */
app.get('/auth/settings', async (c) => {
  try {
    // Get token from query parameter (to avoid CORS preflight)
    const tokenFromQuery = c.req.query('token');

    // Also check Authorization header as fallback
    const authHeader = c.req.header('Authorization');
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const token = tokenFromQuery || tokenFromHeader;

    if (!token) {
      return c.json({ error: 'Unauthorized - No token provided' }, 401);
    }

    const user = await verifyAccessToken(token, c.env);

    if (!user) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    // Get preferences from user-service
    console.log('[auth-service] Getting preferences for user:', user.userId);
    const preferences = await c.env.USER_SERVICE.getPreferences(user.userId);
    console.log('[auth-service] Got preferences:', preferences);

    // Get user details
    console.log('[auth-service] Getting user details for user:', user.userId);
    const userDetails = await c.env.USER_SERVICE.getUserById(user.userId);
    console.log('[auth-service] Got user details:', userDetails);

    return c.json({
      success: true,
      preferences,
      user: userDetails ? {
        firstName: userDetails.firstName,
        lastName: userDetails.lastName,
        zipCode: userDetails.zipCode,
        city: userDetails.city,
        congressionalDistrict: userDetails.congressionalDistrict
      } : null
    });
  } catch (error) {
    console.error('Get settings error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    return c.json({
      error: 'Failed to get settings',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * PUT /auth/settings/interests
 * Update user interests
 */
app.put('/auth/settings/interests', async (c) => {
  try {
    // Verify JWT token
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized - No token provided' }, 401);
    }

    const token = authHeader.substring(7);
    const user = await verifyAccessToken(token, c.env);

    if (!user) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    // Validate request body
    const body = await c.req.json();
    const validation = UpdateInterestsSchema.safeParse(body);

    if (!validation.success) {
      return c.json({
        error: 'Validation failed',
        details: validation.error.issues
      }, 400);
    }

    const { interests } = validation.data;

    // Validate interests against available categories
    const validInterestNames = getInterestNames();
    const invalidInterests = interests.filter(i => !validInterestNames.includes(i));

    if (invalidInterests.length > 0) {
      return c.json({
        error: 'Invalid interests',
        invalidInterests,
        validInterests: validInterestNames
      }, 400);
    }

    // Update preferences
    await c.env.USER_SERVICE.updatePreferences(user.userId, {
      policyInterests: interests
    });

    console.log(`✓ Updated interests for user: ${user.userId}`);

    return c.json({
      success: true,
      message: 'Interests updated successfully',
      interests
    });
  } catch (error) {
    console.error('Update interests error:', error);
    return c.json({
      error: 'Failed to update interests',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /auth/backfill-location
 * Backfill missing city, zip_code, and congressional_district for current user
 * Uses zipcode from user_preferences to lookup and populate users table
 * Accepts token via query parameter to avoid CORS preflight (Cloudflare blocks OPTIONS)
 */
app.post('/auth/backfill-location', async (c) => {
  try {
    // Get token from query parameter (to avoid CORS preflight)
    const tokenFromQuery = c.req.query('token');

    // Also check Authorization header as fallback
    const authHeader = c.req.header('Authorization');
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const token = tokenFromQuery || tokenFromHeader;

    // Debug logging
    console.log('[Backfill] Query token exists:', !!tokenFromQuery);
    console.log('[Backfill] Header token exists:', !!tokenFromHeader);
    console.log('[Backfill] Final token exists:', !!token);
    console.log('[Backfill] Token preview:', token ? `${token.substring(0, 20)}...` : 'null');

    if (!token) {
      console.error('[Backfill] No token provided - tokenFromQuery:', tokenFromQuery, 'tokenFromHeader:', tokenFromHeader);
      return c.json({ error: 'Unauthorized - No token provided' }, 401);
    }

    const user = await verifyAccessToken(token, c.env);

    if (!user) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    const db = c.env.APP_DB;

    // Get user's current data
    const userRecord = await db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(user.userId)
      .first();

    if (!userRecord) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Check if user already has location data
    if (userRecord.zip_code && userRecord.city && userRecord.congressional_district) {
      return c.json({
        success: true,
        message: 'User already has complete location data',
        data: {
          zipCode: userRecord.zip_code,
          city: userRecord.city,
          congressionalDistrict: userRecord.congressional_district
        }
      });
    }

    // Get zipcode from user_preferences
    const prefs = await db
      .prepare('SELECT zipcode, state, district FROM user_preferences WHERE user_id = ?')
      .bind(user.userId)
      .first();

    if (!prefs || !prefs.zipcode) {
      return c.json({
        error: 'No zipcode found in user preferences',
        message: 'Please complete onboarding first or update your profile with a ZIP code'
      }, 400);
    }

    const zipCode = prefs.zipcode as string;

    // Look up district information
    const districtInfo = await c.env.GEOCODIO_CLIENT.lookupDistrict(zipCode);

    if (!districtInfo) {
      return c.json({
        error: 'Failed to lookup congressional district',
        message: `Could not find district information for ZIP code ${zipCode}`
      }, 400);
    }

    const congressionalDistrict = `${districtInfo.state}-${districtInfo.district}`;

    // Update users table
    await db
      .prepare(`
        UPDATE users
        SET
          zip_code = ?,
          city = ?,
          congressional_district = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .bind(
        zipCode,
        districtInfo.city || '',
        congressionalDistrict,
        Date.now(),
        user.userId
      )
      .run();

    console.log(`✓ Backfilled location for user ${user.userId}: ${zipCode}, ${districtInfo.city}, ${congressionalDistrict}`);

    return c.json({
      success: true,
      message: 'Location data backfilled successfully',
      data: {
        zipCode,
        city: districtInfo.city,
        congressionalDistrict
      }
    });
  } catch (error) {
    console.error('Backfill location error:', error);
    return c.json({
      error: 'Failed to backfill location',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /auth/preferences
 * Update user preferences (handles ZIP code changes properly)
 * Accepts token via query parameter to avoid CORS preflight (Cloudflare blocks OPTIONS)
 * Uses POST instead of PUT to avoid CORS preflight (PUT always triggers OPTIONS)
 */
app.post('/auth/preferences', async (c) => {
  try {
    // Get token from query parameter (to avoid CORS preflight)
    const tokenFromQuery = c.req.query('token');

    // Also check Authorization header as fallback
    const authHeader = c.req.header('Authorization');
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const token = tokenFromQuery || tokenFromHeader;

    if (!token) {
      return c.json({ error: 'Unauthorized - No token provided' }, 401);
    }

    const user = await verifyAccessToken(token, c.env);

    if (!user) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    const db = c.env.APP_DB;
    const body = await c.req.json();

    const {
      zipCode,
      policyInterests,
      briefingTime,
      emailNotifications,
      playbackSpeed,
      autoPlay
    } = body;

    // Get current preferences
    const currentPrefs = await db
      .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
      .bind(user.userId)
      .first();

    // Check if ZIP code is changing
    const isZipCodeChanged = zipCode && currentPrefs && zipCode !== currentPrefs.zipcode;

    let districtInfo = null;
    if (isZipCodeChanged) {
      // Look up new congressional district
      districtInfo = await c.env.GEOCODIO_CLIENT.lookupDistrict(zipCode);

      if (!districtInfo) {
        return c.json({
          error: 'Invalid ZIP code',
          message: `Could not find congressional district for ZIP code ${zipCode}`
        }, 400);
      }

      // Update users table with new location data
      const congressionalDistrict = `${districtInfo.state}-${districtInfo.district}`;

      await db
        .prepare(`
          UPDATE users
          SET
            zip_code = ?,
            city = ?,
            congressional_district = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .bind(
          zipCode,
          districtInfo.city || '',
          congressionalDistrict,
          Date.now(),
          user.userId
        )
        .run();

      console.log(`✓ Updated location for user ${user.userId}: ${zipCode}, ${districtInfo.city}, ${congressionalDistrict}`);
    }

    // Update user_preferences table (only columns that exist)
    const updates: string[] = [];
    const binds: any[] = [];

    if (policyInterests !== undefined) {
      updates.push('policy_interests = ?');
      binds.push(JSON.stringify(policyInterests));
    }

    if (zipCode !== undefined) {
      updates.push('zipcode = ?');
      binds.push(zipCode);

      if (districtInfo) {
        updates.push('state = ?');
        binds.push(districtInfo.state);

        updates.push('district = ?');
        binds.push(districtInfo.district);
      }
    }

    // Note: Only updating zipcode, state, district, and policy_interests
    // Other fields (briefingTime, emailNotifications, playbackSpeed, autoPlay)
    // don't exist in current schema

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      binds.push(Date.now());
      binds.push(user.userId);

      await db
        .prepare(`UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = ?`)
        .bind(...binds)
        .run();

      console.log(`✓ Updated preferences for user ${user.userId}`);
    }

    return c.json({
      success: true,
      message: 'Preferences updated successfully',
      districtUpdated: isZipCodeChanged,
      newDistrict: districtInfo ? {
        state: districtInfo.state,
        district: districtInfo.district,
        city: districtInfo.city,
        congressionalDistrict: `${districtInfo.state}-${districtInfo.district}`
      } : undefined
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    return c.json({
      error: 'Failed to update preferences',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /auth/debug/env
 * Debug endpoint to check environment variables
 */
app.get('/auth/debug/env', async (c) => {
  return c.json({
    JWT_SECRET_EXISTS: !!c.env.JWT_SECRET,
    JWT_SECRET_LENGTH: c.env.JWT_SECRET?.length || 0,
    WORKOS_API_KEY_EXISTS: !!c.env.WORKOS_API_KEY,
    WORKOS_CLIENT_ID_EXISTS: !!c.env.WORKOS_CLIENT_ID,
    GEOCODIO_API_KEY_EXISTS: !!c.env.GEOCODIO_API_KEY,
  });
});

/**
 * GET /auth/debug/user
 * Debug endpoint to check user onboarding status
 * Query params: email or userId
 */
app.get('/auth/debug/user', async (c) => {
  try {
    const db = c.env.APP_DB;
    const email = c.req.query('email');
    const userId = c.req.query('userId');

    if (!email && !userId) {
      return c.json({ error: 'Please provide email or userId query parameter' }, 400);
    }

    let user;
    if (email) {
      user = await db
        .prepare('SELECT id, email, first_name, last_name, onboarding_completed, email_verified, workos_user_id, created_at FROM users WHERE email = ?')
        .bind(email)
        .first();
    } else {
      user = await db
        .prepare('SELECT id, email, first_name, last_name, onboarding_completed, email_verified, workos_user_id, created_at FROM users WHERE id = ?')
        .bind(userId)
        .first();
    }

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        onboardingCompleted: user.onboarding_completed,
        onboardingCompletedBoolean: Boolean(user.onboarding_completed),
        emailVerified: user.email_verified,
        workosUserId: user.workos_user_id,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Debug user error:', error);
    return c.json({
      error: 'Failed to fetch user',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
