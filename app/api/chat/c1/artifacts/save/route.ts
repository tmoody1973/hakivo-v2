import { NextRequest, NextResponse } from "next/server";
import { saveArtifact, ArtifactMetadata } from "@/lib/vultr-artifacts";

/**
 * POST /api/chat/c1/artifacts/save
 *
 * Saves an artifact to Vultr Object Storage and the user's documents.
 *
 * Request body:
 * - artifactId: string - Unique artifact identifier
 * - title: string - Document title
 * - type: "report" | "slides" - Artifact type
 * - content: string - The C1 DSL content to save
 * - threadId?: string - Optional thread ID for reference
 * - messageId?: string - Optional message ID for reference
 */

const CHAT_SERVICE_URL = process.env.NEXT_PUBLIC_CHAT_API_URL ||
  "https://svc-01kc6rbecv0s5k4yk6ksdaqyzk.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

interface SaveArtifactRequest {
  artifactId: string;
  title: string;
  type: "report" | "slides";
  content: string;
  threadId?: string;
  messageId?: string;
}

/**
 * Extract user ID from JWT token
 */
function extractUserIdFromToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.substring(7);
    // Decode JWT payload (second part) - this is a simple decode, not verification
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || payload.userId || payload.user_id || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = extractUserIdFromToken(authHeader);
    if (!userId) {
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 }
      );
    }

    const body: SaveArtifactRequest = await req.json();
    const { artifactId, title, type, content, threadId, messageId } = body;

    // Validate required fields
    if (!artifactId || !title || !type || !content) {
      return NextResponse.json(
        { error: "Missing required fields: artifactId, title, type, content" },
        { status: 400 }
      );
    }

    console.log("[Artifacts Save] Saving artifact:", { artifactId, title, type, userId, contentLength: content.length });

    // Prepare metadata for storage
    const metadata: ArtifactMetadata = {
      type,
      template: "chat_artifact",
      title,
      createdAt: new Date().toISOString(),
    };

    // Save to Vultr Object Storage
    const storageResult = await saveArtifact(userId, artifactId, content, metadata);

    if (!storageResult.success) {
      console.error("[Artifacts Save] Vultr storage failed:", storageResult.error);
      return NextResponse.json(
        { error: storageResult.error || "Failed to save artifact to storage" },
        { status: 500 }
      );
    }

    console.log("[Artifacts Save] Saved to Vultr:", storageResult.key);

    // Save reference to user's documents in the backend database
    try {
      const docResponse = await fetch(`${CHAT_SERVICE_URL}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({
          id: artifactId,
          type,
          title,
          storageKey: storageResult.key,
          storageUrl: storageResult.url,
          cdnUrl: storageResult.cdnUrl,
          threadId,
          messageId,
          createdAt: metadata.createdAt,
        }),
      });

      if (!docResponse.ok) {
        console.warn("[Artifacts Save] Document reference save failed:", docResponse.status);
        // Continue anyway - the artifact is saved in storage
      } else {
        console.log("[Artifacts Save] Document reference saved to database");
      }
    } catch (dbError) {
      console.warn("[Artifacts Save] Document reference save error:", dbError);
      // Continue anyway - the artifact is saved in storage
    }

    return NextResponse.json({
      success: true,
      artifactId,
      storageKey: storageResult.key,
      url: storageResult.url,
      cdnUrl: storageResult.cdnUrl,
      message: `${type === "slides" ? "Presentation" : "Report"} saved to your documents`,
    });
  } catch (error) {
    console.error("[Artifacts Save] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
