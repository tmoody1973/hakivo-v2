import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");
  const format = searchParams.get("format") || "pdf";

  if (!id) {
    return NextResponse.json({ error: "Missing artifact ID" }, { status: 400 });
  }

  // TODO: Implement PDF/PPTX export
  return NextResponse.json(
    { error: "Export functionality coming soon", id, format },
    { status: 501 }
  );
}
