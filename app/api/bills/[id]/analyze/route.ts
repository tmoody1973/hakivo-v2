import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // TODO: Implement bill analysis
  return NextResponse.json(
    { error: "Bill analysis endpoint coming soon", billId: id },
    { status: 501 }
  );
}
