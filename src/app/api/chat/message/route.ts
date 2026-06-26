import { NextRequest, NextResponse } from "next/server";

// POST /api/chat/message
export async function POST(req: NextRequest) {
  return NextResponse.json({ message: "stub" });
}
