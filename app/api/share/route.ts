import { NextRequest, NextResponse } from "next/server";

const CHAT_SERVICE_URL =
  process.env.NEXT_PUBLIC_CHAT_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyzk.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

/**
 * POST /api/share - Create a new shared thread
 * Persists to backend database for durability
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const body = await request.json();
    const { sessionId, title, messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Missing required field: messages" },
        { status: 400 }
      );
    }

    // Call backend to create persistent share
    const response = await fetch(`${CHAT_SERVICE_URL}/chat/c1/share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        threadId: sessionId,
        title: title || "Shared Conversation",
        messages: messages.slice(0, 100), // Limit messages
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[Share API] Backend error:", errorData);
      return NextResponse.json(
        { error: errorData.error || "Failed to create share link" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      token: data.token,
      expiresAt: new Date(data.expiresAt).toISOString(),
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
 * Public endpoint - no auth required
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

    // Call backend to get shared thread (public endpoint)
    const response = await fetch(`${CHAT_SERVICE_URL}/chat/c1/share/${token}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 404) {
        return NextResponse.json(
          { error: "Share link not found or expired" },
          { status: 404 }
        );
      }

      if (response.status === 410) {
        return NextResponse.json(
          { error: "Share link has expired" },
          { status: 410 }
        );
      }

      return NextResponse.json(
        { error: errorData.error || "Failed to retrieve shared thread" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const share = data.share;

    return NextResponse.json({
      success: true,
      title: share.title,
      messages: share.messages,
      createdAt: new Date(share.createdAt).toISOString(),
      expiresAt: new Date(share.expiresAt).toISOString(),
    });
  } catch (error) {
    console.error("[Share API] Error retrieving share:", error);
    return NextResponse.json(
      { error: "Failed to retrieve shared thread" },
      { status: 500 }
    );
  }
}
