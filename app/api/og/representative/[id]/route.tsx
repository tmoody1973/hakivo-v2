import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://svc-01k66gywmx8x4r0w31fdjjfekf.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hakivo.com";

async function getMemberData(bioguideId: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/members/${bioguideId}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.member || null;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const member = await getMemberData(id);

  const name = member?.fullName || "Congressional Representative";
  const party = member?.party || "";
  const chamber = member?.chamber || "";
  const state = member?.state || "";
  const district = member?.district;
  const imageUrl = member?.depiction?.imageUrl;

  const partyColor = party === "D" ? "#2563eb" : party === "R" ? "#dc2626" : "#6b7280";
  const partyName = party === "D" ? "Democrat" : party === "R" ? "Republican" : party;
  const title = chamber === "House" ? "U.S. Representative" : "U.S. Senator";
  const location = chamber === "House" && district ? `${state} District ${district}` : state;

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
        {/* Header with Logo */}
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

          {/* Party Badge */}
          <div
            style={{
              display: "flex",
              backgroundColor: partyColor,
              color: "white",
              padding: "12px 24px",
              borderRadius: "24px",
              fontSize: "24px",
              fontWeight: "600",
            }}
          >
            {partyName}
          </div>
        </div>

        {/* Main Content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: "48px",
          }}
        >
          {/* Member Photo or Avatar */}
          <div
            style={{
              width: "200px",
              height: "200px",
              borderRadius: "100px",
              backgroundColor: partyColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "4px solid #334155",
              overflow: "hidden",
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                width="200"
                height="200"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <span
                style={{ fontSize: "72px", fontWeight: "bold", color: "white" }}
              >
                {name.split(" ").map((n: string) => n[0]).join("").substring(0, 2)}
              </span>
            )}
          </div>

          {/* Member Info */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            <h1
              style={{
                fontSize: "56px",
                fontWeight: "bold",
                color: "white",
                margin: 0,
                marginBottom: "16px",
              }}
            >
              {name}
            </h1>
            <div
              style={{
                fontSize: "32px",
                color: "#94a3b8",
                marginBottom: "24px",
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: "flex",
                gap: "24px",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#e2e8f0",
                  fontSize: "28px",
                }}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {location}
              </div>
            </div>
          </div>
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
            Congressional Profile on Hakivo
          </span>
          <span style={{ color: "#64748b", fontSize: "24px" }}>
            hakivo.com/representatives/{id}
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
