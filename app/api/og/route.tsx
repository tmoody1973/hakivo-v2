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
                fontSize: "52px",
                fontWeight: "800",
                color: "white",
                lineHeight: 1,
                letterSpacing: "-2px",
              }}
            >
              UNDERSTAND
            </span>
            <span
              style={{
                fontSize: "52px",
                fontWeight: "800",
                color: "#3b82f6",
                lineHeight: 1,
                letterSpacing: "-2px",
              }}
            >
              CONGRESS
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
            AI-powered legislative summaries, podcast briefings, and representative tracking.
          </p>

          {/* CTA */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#3b82f6",
              color: "white",
              padding: "10px 20px",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "600",
              width: "fit-content",
            }}
          >
            Get Started Free
          </div>

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
          {/* Browser mockup */}
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
                hakivo.com
              </div>
            </div>

            {/* Content area - simulated homepage */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                padding: "24px",
                backgroundColor: "#0f172a",
              }}
            >
              {/* Hero section mockup */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  marginBottom: "20px",
                }}
              >
                <span style={{ color: "#3b82f6", fontSize: "11px", fontWeight: "600", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Your Daily Congressional Brief
                </span>
                <h2
                  style={{
                    fontSize: "22px",
                    fontWeight: "700",
                    color: "white",
                    lineHeight: 1.2,
                    margin: 0,
                    marginBottom: "8px",
                  }}
                >
                  Democracy Made Accessible
                </h2>
                <p style={{ color: "#94a3b8", fontSize: "11px", margin: 0 }}>
                  Stay informed on the legislation that matters to you
                </p>
              </div>

              {/* Feature cards mockup */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                {/* Card 1 */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    backgroundColor: "#1e293b",
                    borderRadius: "8px",
                    padding: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: "28px",
                      height: "28px",
                      backgroundColor: "#3b82f6",
                      borderRadius: "6px",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                    </svg>
                  </div>
                  <span style={{ color: "white", fontSize: "11px", fontWeight: "600" }}>Daily Briefs</span>
                  <span style={{ color: "#64748b", fontSize: "9px" }}>AI summaries</span>
                </div>

                {/* Card 2 */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    backgroundColor: "#1e293b",
                    borderRadius: "8px",
                    padding: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: "28px",
                      height: "28px",
                      backgroundColor: "#10b981",
                      borderRadius: "6px",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    </svg>
                  </div>
                  <span style={{ color: "white", fontSize: "11px", fontWeight: "600" }}>Podcasts</span>
                  <span style={{ color: "#64748b", fontSize: "9px" }}>Audio updates</span>
                </div>

                {/* Card 3 */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    backgroundColor: "#1e293b",
                    borderRadius: "8px",
                    padding: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: "28px",
                      height: "28px",
                      backgroundColor: "#8b5cf6",
                      borderRadius: "6px",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                  </div>
                  <span style={{ color: "white", fontSize: "11px", fontWeight: "600" }}>Track Reps</span>
                  <span style={{ color: "#64748b", fontSize: "9px" }}>Voting records</span>
                </div>
              </div>

              {/* Sample brief preview */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "#1e293b",
                  borderRadius: "8px",
                  padding: "12px",
                  flex: 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981" }} />
                  <span style={{ color: "#10b981", fontSize: "9px", fontWeight: "500" }}>Latest Brief</span>
                </div>
                <span style={{ color: "white", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                  Congressional Update
                </span>
                <span style={{ color: "#64748b", fontSize: "9px", lineHeight: 1.4 }}>
                  Your personalized briefing on today&apos;s legislative activity and key votes...
                </span>
              </div>
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
