import { NextRequest, NextResponse } from "next/server";

const CHAT_SERVICE_URL =
  process.env.NEXT_PUBLIC_CHAT_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyzk.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

/**
 * GET /api/chat/c1/threads/:threadId/messages - Get all messages in a thread
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json({ messages: [] }, { status: 200 });
    }

    const response = await fetch(
      `${CHAT_SERVICE_URL}/chat/c1/threads/${threadId}/messages`,
      {
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ messages: [] }, { status: 200 });
      }
      console.warn("[C1 Messages API] Failed to fetch messages:", response.status);
      return NextResponse.json({ messages: [] }, { status: 200 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[C1 Messages API] Error:", error);
    return NextResponse.json({ messages: [] }, { status: 200 });
  }
}

/**
 * POST /api/chat/c1/threads/:threadId/messages - Add a message to a thread
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await params;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const response = await fetch(
      `${CHAT_SERVICE_URL}/chat/c1/threads/${threadId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[C1 Messages API] Failed to add message:", error);
      return NextResponse.json(
        { error: "Failed to add message" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[C1 Messages API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
