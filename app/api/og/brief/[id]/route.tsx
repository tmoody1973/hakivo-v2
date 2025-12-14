import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://svc-01k66gywmx8x4r0w31fdjjfekf.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";

async function getBriefData(briefId: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/briefs/${briefId}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data || null;
  } catch {
    return null;
  }
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const brief = await getBriefData(id);

  const title = brief?.title || "Daily Congressional Brief";
  const headline = brief?.headline || "";
  const createdAt = brief?.createdAt ? formatDate(brief.createdAt) : "";
  const interests = brief?.interests || [];
  const articleCount = brief?.articles?.length || 0;
  const hasAudio = !!brief?.audioUrl;

  // Truncate headline
  const truncatedHeadline =
    headline.length > 120 ? headline.substring(0, 117) + "..." : headline;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0f172a",
          padding: "60px",
        }}
      >
        {/* Header with Logo and Date */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "40px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "#3b82f6",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              </svg>
            </div>
            <span
              style={{ fontSize: "32px", fontWeight: "bold", color: "white" }}
            >
              Hakivo
            </span>
          </div>

          {/* Date Badge */}
          {createdAt && (
            <div
              style={{
                display: "flex",
                backgroundColor: "#1e40af",
                color: "white",
                padding: "12px 24px",
                borderRadius: "24px",
                fontSize: "20px",
                fontWeight: "500",
              }}
            >
              {createdAt}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {/* Brief Type Label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "16px",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
            >
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
              <path d="M18 14h-8" />
              <path d="M15 18h-5" />
              <path d="M10 6h8v4h-8V6Z" />
            </svg>
            <span style={{ color: "#3b82f6", fontSize: "24px", fontWeight: "600" }}>
              Daily Congressional Brief
            </span>
            {hasAudio && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  backgroundColor: "#10b981",
                  color: "white",
                  padding: "6px 12px",
                  borderRadius: "12px",
                  fontSize: "16px",
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                </svg>
                Audio
              </div>
            )}
          </div>

          <h1
            style={{
              fontSize: "52px",
              fontWeight: "bold",
              color: "white",
              lineHeight: 1.2,
              margin: 0,
              marginBottom: "24px",
            }}
          >
            {title}
          </h1>

          {truncatedHeadline && (
            <p
              style={{
                fontSize: "28px",
                color: "#94a3b8",
                lineHeight: 1.4,
                margin: 0,
                marginBottom: "24px",
              }}
            >
              {truncatedHeadline}
            </p>
          )}

          {/* Interests Tags */}
          {interests.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              {interests.slice(0, 4).map((interest: string, i: number) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: "#334155",
                    color: "#e2e8f0",
                    padding: "8px 16px",
                    borderRadius: "16px",
                    fontSize: "18px",
                  }}
                >
                  {interest}
                </div>
              ))}
              {interests.length > 4 && (
                <div
                  style={{
                    backgroundColor: "#334155",
                    color: "#94a3b8",
                    padding: "8px 16px",
                    borderRadius: "16px",
                    fontSize: "18px",
                  }}
                >
                  +{interests.length - 4} more
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "40px",
            paddingTop: "24px",
            borderTop: "1px solid #334155",
          }}
        >
          <span style={{ color: "#64748b", fontSize: "24px" }}>
            {articleCount > 0 ? `${articleCount} articles` : "Personalized Congressional News"}
          </span>
          <span style={{ color: "#64748b", fontSize: "24px" }}>
            hakivo.com/briefs/{id}
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
