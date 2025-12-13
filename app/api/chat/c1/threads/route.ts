import { NextRequest, NextResponse } from "next/server";

const CHAT_SERVICE_URL =
  process.env.NEXT_PUBLIC_CHAT_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyzk.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

/**
 * GET /api/chat/c1/threads - List all threads for the user
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json({ threads: [] }, { status: 200 });
    }

    const response = await fetch(`${CHAT_SERVICE_URL}/chat/c1/threads`, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn("[C1 Threads API] Failed to fetch threads:", response.status);
      return NextResponse.json({ threads: [] }, { status: 200 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[C1 Threads API] Error:", error);
    return NextResponse.json({ threads: [] }, { status: 200 });
  }
}

/**
 * POST /api/chat/c1/threads - Create a new thread
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const response = await fetch(`${CHAT_SERVICE_URL}/chat/c1/threads`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[C1 Threads API] Failed to create thread:", error);
      return NextResponse.json(
        { error: "Failed to create thread" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[C1 Threads API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
