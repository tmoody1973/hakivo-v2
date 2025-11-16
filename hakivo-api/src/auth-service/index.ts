import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import * as jose from 'jose';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';

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

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

/**
 * Generate JWT access token
 */
async function generateAccessToken(userId: string, email: string): Promise<string> {
  const jwtSecret = process.env.JWT_SECRET;
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
async function verifyAccessToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jose.jwtVerify(token, secret);

    if (typeof payload.userId !== 'string' || typeof payload.email !== 'string') {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email
    };
  } catch (error) {
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
    const accessToken = await generateAccessToken(userId, email);
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
    const accessToken = await generateAccessToken(userId, email);
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
 */
app.post('/auth/refresh', async (c) => {
  try {
    const db = c.env.APP_DB;

    // Validate input
    const body = await c.req.json();
    const validation = RefreshSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: 'Invalid input', details: validation.error.errors }, 400);
    }

    const { refreshToken } = validation.data;

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
    const accessToken = await generateAccessToken(userId, user.email as string);

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
    const payload = await verifyAccessToken(token);

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
    const payload = await verifyAccessToken(token);

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

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
