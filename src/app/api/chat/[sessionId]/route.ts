import { NextRequest, NextResponse } from "next/server";

// GET /api/chat/:sessionId
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  return NextResponse.json({ sessionId, messages: [] });
}
