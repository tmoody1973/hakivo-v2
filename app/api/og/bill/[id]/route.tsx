import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://svc-01kc6rbecv0s5k4yk6ksdaqyzh.01k66gywmx8x4r0w31fdjjfekf.lmapp.run";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hakivo.com";

async function getBillData(billId: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/bills/${billId}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.bill || null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const bill = await getBillData(id);

  const title = bill?.title || "Legislative Bill";
  const billNumber = bill
    ? `${bill.type?.toUpperCase()}.${bill.number}`
    : id.toUpperCase();
  const congress = bill?.congress ? `${bill.congress}th Congress` : "";
  const chamber = bill?.originChamber || "";
  const policyArea = bill?.policyArea || "";
  const sponsor = bill?.sponsor?.fullName || "";
  const party = bill?.sponsor?.party || "";
  const state = bill?.sponsor?.state || "";

  // Truncate title to fit
  const truncatedTitle =
    title.length > 100 ? title.substring(0, 97) + "..." : title;

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
        {/* Header with Logo and Badge */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "40px",
          }}
        >
          {/* Logo */}
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

          {/* Bill Badge */}
          <div
            style={{
              display: "flex",
              backgroundColor: "#1e40af",
              color: "white",
              padding: "12px 24px",
              borderRadius: "24px",
              fontSize: "24px",
              fontWeight: "600",
            }}
          >
            {billNumber}
          </div>
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
          <h1
            style={{
              fontSize: "48px",
              fontWeight: "bold",
              color: "white",
              lineHeight: 1.2,
              margin: 0,
              marginBottom: "24px",
            }}
          >
            {truncatedTitle}
          </h1>

          {/* Meta info row */}
          <div
            style={{
              display: "flex",
              gap: "24px",
              flexWrap: "wrap",
            }}
          >
            {congress && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#94a3b8",
                  fontSize: "24px",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 21h18M5 21V7l8-4 8 4v14M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
                </svg>
                {congress}
              </div>
            )}
            {chamber && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "#94a3b8",
                  fontSize: "24px",
                }}
              >
                {chamber}
              </div>
            )}
            {policyArea && (
              <div
                style={{
                  display: "flex",
                  backgroundColor: "#334155",
                  color: "#e2e8f0",
                  padding: "6px 16px",
                  borderRadius: "16px",
                  fontSize: "20px",
                }}
              >
                {policyArea}
              </div>
            )}
          </div>
        </div>

        {/* Footer with sponsor info */}
        {sponsor && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginTop: "40px",
              paddingTop: "24px",
              borderTop: "1px solid #334155",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "28px",
                backgroundColor: party === "D" ? "#2563eb" : party === "R" ? "#dc2626" : "#6b7280",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "24px",
                fontWeight: "bold",
              }}
            >
              {sponsor.split(" ").map((n: string) => n[0]).join("").substring(0, 2)}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{ color: "white", fontSize: "24px", fontWeight: "600" }}
              >
                Sponsored by {sponsor}
              </span>
              <span style={{ color: "#94a3b8", fontSize: "20px" }}>
                {party === "D" ? "Democrat" : party === "R" ? "Republican" : party} - {state}
              </span>
            </div>
          </div>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
