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

// Extract first paragraph from markdown content
function getContentPreview(content: string, maxLength: number = 200): string {
  if (!content) return "";
  // Remove markdown formatting and get plain text
  const plainText = content
    .replace(/#{1,6}\s/g, "") // headers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // images
    .replace(/^[-*]\s/gm, "") // list items
    .replace(/\n+/g, " ") // newlines
    .trim();

  if (plainText.length <= maxLength) return plainText;
  return plainText.substring(0, maxLength).trim() + "...";
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
  const hasAudio = !!brief?.audio_url;
  const featuredImage = brief?.featured_image || brief?.brief?.featured_image;
  const content = brief?.content || brief?.brief?.content || "";
  const contentPreview = getContentPreview(content, 280);

  // Truncate headline for left side
  const truncatedHeadline =
    headline.length > 80 ? headline.substring(0, 77) + "..." : headline;

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
            width: "42%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "45px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${SITE_URL}/hakivo.png`}
            width="140"
            height="60"
            alt="Hakivo"
            style={{ objectFit: "contain", marginBottom: "20px" }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginBottom: "20px",
            }}
          >
            <span
              style={{
                fontSize: "56px",
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
                fontSize: "56px",
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
              fontSize: "18px",
              color: "#94a3b8",
              lineHeight: 1.4,
              margin: 0,
              marginBottom: "20px",
            }}
          >
            {truncatedHeadline || "Personalized congressional news and legislation tracking."}
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
                fontSize: "14px",
                fontWeight: "600",
                width: "fit-content",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
              </svg>
              Listen Now
            </div>
          )}

          {/* From line */}
          <span style={{ color: "#64748b", fontSize: "14px", marginTop: "auto" }}>
            From hakivo.com
          </span>
        </div>

        {/* RIGHT SIDE - Screenshot Preview */}
        <div
          style={{
            width: "58%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "30px",
            paddingLeft: "15px",
          }}
        >
          {/* Phone/Browser mockup */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              height: "100%",
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
          >
            {/* Browser header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 16px",
                backgroundColor: "#f1f5f9",
                borderBottom: "1px solid #e2e8f0",
                gap: "8px",
              }}
            >
              {/* Browser dots */}
              <div style={{ display: "flex", gap: "6px" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ef4444" }} />
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#eab308" }} />
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#22c55e" }} />
              </div>
              {/* URL bar */}
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  backgroundColor: "#ffffff",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "12px",
                  color: "#64748b",
                  marginLeft: "8px",
                }}
              >
                hakivo.com/briefs/{id.substring(0, 8)}...
              </div>
            </div>

            {/* Content area */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                padding: "20px",
                backgroundColor: "#ffffff",
              }}
            >
              {/* Date */}
              {createdAt && (
                <span style={{ color: "#3b82f6", fontSize: "12px", fontWeight: "500", marginBottom: "8px" }}>
                  {createdAt}
                </span>
              )}

              {/* Title */}
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  color: "#0f172a",
                  lineHeight: 1.2,
                  margin: 0,
                  marginBottom: "12px",
                }}
              >
                {title.length > 60 ? title.substring(0, 57) + "..." : title}
              </h2>

              {/* Featured Image (if available) */}
              {featuredImage && (
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    height: "120px",
                    borderRadius: "8px",
                    overflow: "hidden",
                    marginBottom: "12px",
                    backgroundColor: "#f1f5f9",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featuredImage}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              )}

              {/* Content preview */}
              <p
                style={{
                  fontSize: "13px",
                  color: "#475569",
                  lineHeight: 1.5,
                  margin: 0,
                  display: "-webkit-box",
                  overflow: "hidden",
                }}
              >
                {contentPreview || "Your personalized congressional news brief with the latest legislative updates, bill tracking, and representative activity..."}
              </p>

              {/* Fade out effect at bottom */}
              <div
                style={{
                  display: "flex",
                  marginTop: "auto",
                  height: "40px",
                  background: "linear-gradient(transparent, white)",
                }}
              />
            </div>
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
