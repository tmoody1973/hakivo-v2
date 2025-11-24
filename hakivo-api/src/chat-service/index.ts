import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Env } from './raindrop.gen';
import { z } from 'zod';

// Validation schemas
const CreateSessionSchema = z.object({
  billId: z.number().int()
});

const SendMessageSchema = z.object({
  message: z.string().min(1).max(1000)
});

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('*', cors());

/**
 * Verify JWT token from auth header
 */
async function verifyAuth(authHeader: string | undefined, jwtSecret: string): Promise<{ userId: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);

    if (typeof payload.userId !== 'string') {
      return null;
    }

    return { userId: payload.userId };
  } catch (error) {
    return null;
  }
}

/**
 * Require authentication middleware
 */
async function requireAuth(c: any): Promise<{ userId: string } | Response> {
  const authHeader = c.req.header('Authorization');
  const auth = await verifyAuth(authHeader, c.env.JWT_SECRET);

  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return auth;
}

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'chat-service', timestamp: new Date().toISOString() });
});

/**
 * POST /chat/sessions
 * Create a new chat session for a bill (requires auth)
 */
app.post('/chat/sessions', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;

    // Validate input
    const body = await c.req.json();
    const validation = CreateSessionSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: 'Invalid input', details: validation.error.errors }, 400);
    }

    const { billId } = validation.data;

    // Verify bill exists
    const bill = await db
      .prepare('SELECT id FROM bills WHERE id = ?')
      .bind(billId)
      .first();

    if (!bill) {
      return c.json({ error: 'Bill not found' }, 404);
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    await db
      .prepare(`
        INSERT INTO chat_sessions (id, user_id, bill_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(sessionId, auth.userId, billId, now, now)
      .run();

    console.log(`✓ Chat session created: ${sessionId} for bill ${billId}`);

    return c.json({
      success: true,
      sessionId,
      billId,
      createdAt: now
    }, 201);
  } catch (error) {
    console.error('Create session error:', error);
    return c.json({
      error: 'Failed to create chat session',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /chat/sessions/:sessionId/messages
 * Send a message and get RAG-based response (requires auth)
 */
app.post('/chat/sessions/:sessionId/messages', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const sessionId = c.req.param('sessionId');

    // Validate input
    const body = await c.req.json();
    const validation = SendMessageSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: 'Invalid input', details: validation.error.errors }, 400);
    }

    const { message } = validation.data;

    // Verify session ownership
    const session = await db
      .prepare('SELECT user_id, bill_id FROM chat_sessions WHERE id = ?')
      .bind(sessionId)
      .first();

    if (!session) {
      return c.json({ error: 'Chat session not found' }, 404);
    }

    if (session.user_id !== auth.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    const billId = session.bill_id as number;

    // Save user message
    const userMessageId = crypto.randomUUID();
    const now = Date.now();

    await db
      .prepare(`
        INSERT INTO chat_messages (id, session_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(userMessageId, sessionId, 'user', message, now)
      .run();

    // Get bill details for context
    const bill = await db
      .prepare('SELECT congress_id, bill_type, bill_number, title, latest_action_text FROM bills WHERE id = ?')
      .bind(billId)
      .first();

    if (!bill) {
      return c.json({ error: 'Bill not found' }, 404);
    }

    // TODO: When SmartBucket is added, use it for semantic search of bill text
    // For now, use bill metadata as context
    const billContext = `
Bill: ${bill.title}
Congress: ${bill.congress_id}
Type: ${String(bill.bill_type).toUpperCase()} ${bill.bill_number}
Latest Action: ${bill.latest_action_text}
`.trim();

    // Generate response using Cerebras
    const messages = [
      {
        role: 'system' as const,
        content: `You are a helpful assistant that answers questions about US Congressional bills.
Provide accurate, concise answers based on the bill information provided.
If you don't have enough information to answer, say so.`
      },
      {
        role: 'user' as const,
        content: `${billContext}

Question: ${message}`
      }
    ];

    const result = await c.env.CEREBRAS_CLIENT.generateCompletion(messages, 0.7, 500);
    const answer = result.content;

    // Save assistant message
    const assistantMessageId = crypto.randomUUID();
    await db
      .prepare(`
        INSERT INTO chat_messages (id, session_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(assistantMessageId, sessionId, 'assistant', answer, Date.now())
      .run();

    // Update session timestamp
    await db
      .prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?')
      .bind(Date.now(), sessionId)
      .run();

    console.log(`✓ Chat message processed for session ${sessionId}`);

    return c.json({
      success: true,
      message: {
        id: assistantMessageId,
        role: 'assistant',
        content: answer,
        createdAt: Date.now()
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    return c.json({
      error: 'Failed to send message',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /chat/sessions/:sessionId/messages
 * Get chat history for a session (requires auth)
 */
app.get('/chat/sessions/:sessionId/messages', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const sessionId = c.req.param('sessionId');

    // Verify session ownership
    const session = await db
      .prepare('SELECT user_id FROM chat_sessions WHERE id = ?')
      .bind(sessionId)
      .first();

    if (!session) {
      return c.json({ error: 'Chat session not found' }, 404);
    }

    if (session.user_id !== auth.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Get messages
    const result = await db
      .prepare(`
        SELECT id, role, content, created_at
        FROM chat_messages
        WHERE session_id = ?
        ORDER BY created_at ASC
      `)
      .bind(sessionId)
      .all();

    const messages = result.results?.map((row: any) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at
    })) || [];

    return c.json({
      success: true,
      messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return c.json({
      error: 'Failed to get messages',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /chat/sessions
 * List user's chat sessions (requires auth)
 */
app.get('/chat/sessions', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;

    // Get sessions with bill info
    const result = await db
      .prepare(`
        SELECT
          s.id,
          s.bill_id,
          s.created_at,
          s.updated_at,
          b.congress_id,
          b.bill_type,
          b.bill_number,
          b.title
        FROM chat_sessions s
        INNER JOIN bills b ON s.bill_id = b.id
        WHERE s.user_id = ?
        ORDER BY s.updated_at DESC
      `)
      .bind(auth.userId)
      .all();

    const sessions = result.results?.map((row: any) => ({
      id: row.id,
      billId: row.bill_id,
      bill: {
        congress: row.congress_id,
        type: row.bill_type,
        number: row.bill_number,
        title: row.title
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) || [];

    return c.json({
      success: true,
      sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    return c.json({
      error: 'Failed to get sessions',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * DELETE /chat/sessions/:sessionId
 * Delete a chat session (requires auth)
 */
app.delete('/chat/sessions/:sessionId', async (c) => {
  try {
    const auth = await requireAuth(c);
    if (auth instanceof Response) return auth;

    const db = c.env.APP_DB;
    const sessionId = c.req.param('sessionId');

    // Verify ownership
    const session = await db
      .prepare('SELECT user_id FROM chat_sessions WHERE id = ?')
      .bind(sessionId)
      .first();

    if (!session) {
      return c.json({ error: 'Chat session not found' }, 404);
    }

    if (session.user_id !== auth.userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    // Delete session (messages will cascade delete due to foreign key)
    await db
      .prepare('DELETE FROM chat_sessions WHERE id = ?')
      .bind(sessionId)
      .run();

    console.log(`✓ Chat session deleted: ${sessionId}`);

    return c.json({
      success: true,
      message: 'Chat session deleted successfully'
    });
  } catch (error) {
    console.error('Delete session error:', error);
    return c.json({
      error: 'Failed to delete session',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
