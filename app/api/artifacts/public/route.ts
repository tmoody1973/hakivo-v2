/**
 * Public Artifacts API Route
 *
 * GET - Fetch public artifact by share token (no auth required)
 */

import { NextRequest, NextResponse } from "next/server";

// Database service URL
const DB_SERVICE_URL = process.env.DB_ADMIN_SERVICE_URL || "http://localhost:8787";

/**
 * GET - Fetch public artifact by share token
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Share token is required" },
        { status: 400 }
      );
    }

    // Fetch artifact by share_token
    const response = await fetch(`${DB_SERVICE_URL}/api/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          SELECT id, type, template, title, content, subject_type, subject_id,
                 audience, is_public, share_token, view_count, created_at
          FROM artifacts
          WHERE share_token = $1
        `,
        params: [token],
      }),
    });

    if (!response.ok) {
      console.error("[Public Artifacts API] Database error:", response.status);
      return NextResponse.json(
        { error: "Failed to fetch artifact" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const artifact = data.rows?.[0];

    // Check if artifact exists
    if (!artifact) {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 }
      );
    }

    // Check if artifact is public
    if (!artifact.is_public) {
      return NextResponse.json(
        { error: "This artifact is not publicly shared" },
        { status: 403 }
      );
    }

    // Increment view count (fire and forget)
    fetch(`${DB_SERVICE_URL}/api/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `UPDATE artifacts SET view_count = view_count + 1 WHERE id = $1`,
        params: [artifact.id],
      }),
    }).catch(console.error);

    return NextResponse.json({
      artifact: {
        id: artifact.id,
        type: artifact.type,
        template: artifact.template,
        title: artifact.title,
        content: artifact.content,
        subjectType: artifact.subject_type,
        subjectId: artifact.subject_id,
        audience: artifact.audience,
        shareToken: artifact.share_token,
        viewCount: artifact.view_count + 1, // Include the current view
        createdAt: artifact.created_at,
      },
    });
  } catch (error) {
    console.error("[Public Artifacts API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
