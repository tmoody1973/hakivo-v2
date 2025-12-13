/**
 * Artifacts API Route
 *
 * GET - List user's artifacts (with pagination)
 * PATCH - Update artifact (share toggle)
 * DELETE - Delete artifact
 *
 * Protected by Arcjet: 30 req/min per user
 */

import { NextRequest, NextResponse } from "next/server";
import {
  authenticatedDataProtection,
  handleArcjetDecision,
  extractUserIdFromAuth,
} from "@/lib/security/arcjet";

// Database service URL
const DB_SERVICE_URL = process.env.DB_ADMIN_SERVICE_URL || "http://localhost:8787";

interface ArtifactRecord {
  id: string;
  user_id: string;
  type: "report" | "slides";
  template: string;
  title: string;
  content: string;
  subject_type?: string;
  subject_id?: string;
  audience?: string;
  is_public: boolean;
  share_token?: string;
  view_count: number;
  created_at: string;
}

/**
 * GET - List user's artifacts
 */
export async function GET(request: NextRequest) {
  try {
    const userId = extractUserIdFromAuth(request.headers.get("authorization"));
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Arcjet rate limiting - 30 req/min per user
    const decision = await authenticatedDataProtection.protect(request, { userId });
    const arcjetResult = handleArcjetDecision(decision);
    if (arcjetResult.blocked) {
      return NextResponse.json(
        { error: arcjetResult.message },
        { status: arcjetResult.status }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    // Fetch artifacts for user
    const response = await fetch(`${DB_SERVICE_URL}/api/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          SELECT id, user_id, type, template, title, subject_type, subject_id,
                 audience, is_public, share_token, view_count, created_at
          FROM artifacts
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2 OFFSET $3
        `,
        params: [userId, limit, offset],
      }),
    });

    if (!response.ok) {
      console.error("[Artifacts API] Database error:", response.status);
      return NextResponse.json(
        { error: "Failed to fetch artifacts" },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Get total count
    const countResponse = await fetch(`${DB_SERVICE_URL}/api/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `SELECT COUNT(*) as count FROM artifacts WHERE user_id = $1`,
        params: [userId],
      }),
    });

    let totalCount = 0;
    if (countResponse.ok) {
      const countData = await countResponse.json();
      totalCount = parseInt(countData.rows?.[0]?.count || "0");
    }

    return NextResponse.json({
      artifacts: data.rows || [],
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error("[Artifacts API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update artifact (share toggle)
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = extractUserIdFromAuth(request.headers.get("authorization"));
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Arcjet rate limiting - 30 req/min per user
    const decision = await authenticatedDataProtection.protect(request, { userId });
    const arcjetResult = handleArcjetDecision(decision);
    if (arcjetResult.blocked) {
      return NextResponse.json(
        { error: arcjetResult.message },
        { status: arcjetResult.status }
      );
    }

    const body = await request.json();
    const { artifactId, isPublic } = body;

    if (!artifactId) {
      return NextResponse.json(
        { error: "Artifact ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const checkResponse = await fetch(`${DB_SERVICE_URL}/api/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `SELECT id, user_id, share_token FROM artifacts WHERE id = $1`,
        params: [artifactId],
      }),
    });

    if (!checkResponse.ok) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    const checkData = await checkResponse.json();
    const artifact = checkData.rows?.[0];

    if (!artifact || artifact.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Generate share token if making public and doesn't have one
    let shareToken = artifact.share_token;
    if (isPublic && !shareToken) {
      shareToken = generateShareToken();
    }

    // Update artifact
    const updateResponse = await fetch(`${DB_SERVICE_URL}/api/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          UPDATE artifacts
          SET is_public = $1, share_token = $2, updated_at = NOW()
          WHERE id = $3
          RETURNING id, is_public, share_token
        `,
        params: [isPublic, shareToken, artifactId],
      }),
    });

    if (!updateResponse.ok) {
      return NextResponse.json(
        { error: "Failed to update artifact" },
        { status: 500 }
      );
    }

    const updateData = await updateResponse.json();
    const updated = updateData.rows?.[0];

    // Generate share URL if public
    const shareUrl = updated?.is_public && updated?.share_token
      ? `${process.env.NEXT_PUBLIC_APP_URL || "https://hakivo.com"}/artifacts/${updated.share_token}`
      : null;

    return NextResponse.json({
      success: true,
      artifact: updated,
      shareUrl,
    });
  } catch (error) {
    console.error("[Artifacts API] Update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete artifact
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = extractUserIdFromAuth(request.headers.get("authorization"));
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Arcjet rate limiting - 30 req/min per user
    const decision = await authenticatedDataProtection.protect(request, { userId });
    const arcjetResult = handleArcjetDecision(decision);
    if (arcjetResult.blocked) {
      return NextResponse.json(
        { error: arcjetResult.message },
        { status: arcjetResult.status }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const artifactId = searchParams.get("id");

    if (!artifactId) {
      return NextResponse.json(
        { error: "Artifact ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership before deleting
    const checkResponse = await fetch(`${DB_SERVICE_URL}/api/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `SELECT user_id FROM artifacts WHERE id = $1`,
        params: [artifactId],
      }),
    });

    if (!checkResponse.ok) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    const checkData = await checkResponse.json();
    const artifact = checkData.rows?.[0];

    if (!artifact || artifact.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete artifact
    const deleteResponse = await fetch(`${DB_SERVICE_URL}/api/database/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `DELETE FROM artifacts WHERE id = $1`,
        params: [artifactId],
      }),
    });

    if (!deleteResponse.ok) {
      return NextResponse.json(
        { error: "Failed to delete artifact" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Artifacts API] Delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Generate a unique share token
 */
function generateShareToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
