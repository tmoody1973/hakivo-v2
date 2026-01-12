import { ImageResponse } from "next/og";

export const runtime = "edge";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hakivo.com";

export async function GET() {
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
            width="180"
            height="80"
            alt="Hakivo"
            style={{ objectFit: "contain", marginBottom: "32px" }}
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
                fontSize: "64px",
                fontWeight: "800",
                color: "white",
                lineHeight: 1.1,
                letterSpacing: "-2px",
              }}
            >
              UNDERSTAND
            </span>
            <span
              style={{
                fontSize: "64px",
                fontWeight: "800",
                color: "#3b82f6",
                lineHeight: 1.1,
                letterSpacing: "-2px",
              }}
            >
              CONGRESS
            </span>
          </div>

          <p
            style={{
              fontSize: "24px",
              color: "#94a3b8",
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            Democracy made accessible.
          </p>
        </div>

        {/* RIGHT SIDE - Features Preview */}
        <div
          style={{
            width: "55%",
            display: "flex",
            flexDirection: "column",
            padding: "50px",
            backgroundColor: "#1e293b",
          }}
        >
          {/* Feature 1 */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "48px",
                height: "48px",
                backgroundColor: "#3b82f6",
                borderRadius: "12px",
                flexShrink: 0,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                <path d="M18 14h-8" />
                <path d="M15 18h-5" />
                <path d="M10 6h8v4h-8V6Z" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "white", fontSize: "22px", fontWeight: "600", marginBottom: "4px" }}>
                Daily Briefings
              </span>
              <span style={{ color: "#94a3b8", fontSize: "16px" }}>
                AI-powered summaries of legislation that matters to you
              </span>
            </div>
          </div>

          {/* Feature 2 */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "48px",
                height: "48px",
                backgroundColor: "#10b981",
                borderRadius: "12px",
                flexShrink: 0,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "white", fontSize: "22px", fontWeight: "600", marginBottom: "4px" }}>
                Podcast Episodes
              </span>
              <span style={{ color: "#94a3b8", fontSize: "16px" }}>
                Listen to your personalized congressional updates
              </span>
            </div>
          </div>

          {/* Feature 3 */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "48px",
                height: "48px",
                backgroundColor: "#8b5cf6",
                borderRadius: "12px",
                flexShrink: 0,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ color: "white", fontSize: "22px", fontWeight: "600", marginBottom: "4px" }}>
                Track Representatives
              </span>
              <span style={{ color: "#94a3b8", fontSize: "16px" }}>
                Monitor voting records and legislative activity
              </span>
            </div>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1, display: "flex" }} />

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "20px",
              borderTop: "1px solid #475569",
            }}
          >
            <span style={{ color: "#64748b", fontSize: "18px" }}>
              Bills, Votes & Representatives Explained
            </span>
            <span style={{ color: "#64748b", fontSize: "18px" }}>
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
