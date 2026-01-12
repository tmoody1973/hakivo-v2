import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const BRIEFS_API_URL = process.env.NEXT_PUBLIC_BRIEFS_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzj.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hakivo.com";

async function getBriefData(briefId: string) {
  try {
    const response = await fetch(`${BRIEFS_API_URL}/briefs/${briefId}`, {
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const brief = await getBriefData(id);

  const title = brief?.title || "Daily Congressional Brief";
  const headline = brief?.headline || "";
  const createdAt = brief?.created_at ? formatDate(brief.created_at) : "";
  const interests = brief?.interests || [];
  const articleCount = brief?.articles?.length || 0;
  const hasAudio = !!brief?.audio_url;

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
          backgroundColor: "#0f172a",
        }}
      >
        {/* LEFT SIDE - Branding */}
        <div
          style={{
            width: "45%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "50px",
            borderRight: "3px solid #1e40af",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${SITE_URL}/hakivo.png`}
            width="160"
            height="70"
            alt="Hakivo"
            style={{ objectFit: "contain", marginBottom: "24px" }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginBottom: "24px",
            }}
          >
            <span
              style={{
                fontSize: "72px",
                fontWeight: "800",
                color: "white",
                lineHeight: 1,
                letterSpacing: "-2px",
              }}
            >
              DAILY
            </span>
            <span
              style={{
                fontSize: "72px",
                fontWeight: "800",
                color: "#3b82f6",
                lineHeight: 1,
                letterSpacing: "-2px",
              }}
            >
              BRIEF
            </span>
          </div>

          <p
            style={{
              fontSize: "22px",
              color: "#94a3b8",
              lineHeight: 1.4,
              margin: 0,
              marginBottom: "24px",
            }}
          >
            Personalized congressional news and legislation tracking.
          </p>

          {/* Audio badge */}
          {hasAudio && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "#10b981",
                color: "white",
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "16px",
                fontWeight: "600",
                width: "fit-content",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
              </svg>
              Listen Now
            </div>
          )}
        </div>

        {/* RIGHT SIDE - Content Preview */}
        <div
          style={{
            width: "55%",
            display: "flex",
            flexDirection: "column",
            padding: "50px",
            backgroundColor: "#1e293b",
          }}
        >
          {/* Date Badge */}
          {createdAt && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "20px",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span style={{ color: "#3b82f6", fontSize: "18px", fontWeight: "500" }}>
                {createdAt}
              </span>
            </div>
          )}

          {/* Title */}
          <h1
            style={{
              fontSize: "36px",
              fontWeight: "bold",
              color: "white",
              lineHeight: 1.2,
              margin: 0,
              marginBottom: "16px",
            }}
          >
            {title}
          </h1>

          {/* Headline */}
          {truncatedHeadline && (
            <p
              style={{
                fontSize: "20px",
                color: "#cbd5e1",
                lineHeight: 1.5,
                margin: 0,
                marginBottom: "24px",
              }}
            >
              {truncatedHeadline}
            </p>
          )}

          {/* Spacer */}
          <div style={{ flex: 1, display: "flex" }} />

          {/* Interests Tags */}
          {interests.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginBottom: "20px",
              }}
            >
              {interests.slice(0, 4).map((interest: string, i: number) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: "#334155",
                    color: "#e2e8f0",
                    padding: "6px 14px",
                    borderRadius: "14px",
                    fontSize: "14px",
                    fontWeight: "500",
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
                    padding: "6px 14px",
                    borderRadius: "14px",
                    fontSize: "14px",
                  }}
                >
                  +{interests.length - 4} more
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "16px",
              borderTop: "1px solid #475569",
            }}
          >
            <span style={{ color: "#64748b", fontSize: "16px" }}>
              {articleCount > 0 ? `${articleCount} articles` : "Congressional News"}
            </span>
            <span style={{ color: "#64748b", fontSize: "16px" }}>
              hakivo.com
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
