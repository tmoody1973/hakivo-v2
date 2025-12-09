import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";

// In-memory store for shared threads (in production, use a database)
// This is a simple KV-style store keyed by share token
const sharedThreads = new Map<
  string,
  {
    sessionId: string;
    title: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    createdAt: Date;
    expiresAt: Date;
  }
>();

// Clean up expired threads periodically
function cleanupExpiredThreads() {
  const now = new Date();
  for (const [token, thread] of sharedThreads.entries()) {
    if (thread.expiresAt < now) {
      sharedThreads.delete(token);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredThreads, 60 * 60 * 1000);

/**
 * POST /api/share - Create a new shared thread
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, title, messages } = body;

    if (!sessionId || !messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, messages" },
        { status: 400 }
      );
    }

    // Generate unique share token
    const token = nanoid(12);

    // Set expiration to 7 days from now
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Store the shared thread
    sharedThreads.set(token, {
      sessionId,
      title: title || "Shared Conversation",
      messages: messages.slice(0, 100), // Limit messages
      createdAt: now,
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[Share API] Error creating share:", error);
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/share?token=xxx - Retrieve a shared thread
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Missing token parameter" },
        { status: 400 }
      );
    }

    const thread = sharedThreads.get(token);

    if (!thread) {
      return NextResponse.json(
        { error: "Share link not found or expired" },
        { status: 404 }
      );
    }

    // Check if expired
    if (thread.expiresAt < new Date()) {
      sharedThreads.delete(token);
      return NextResponse.json(
        { error: "Share link has expired" },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      title: thread.title,
      messages: thread.messages,
      createdAt: thread.createdAt.toISOString(),
      expiresAt: thread.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("[Share API] Error retrieving share:", error);
    return NextResponse.json(
      { error: "Failed to retrieve shared thread" },
      { status: 500 }
    );
  }
}
