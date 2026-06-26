import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getConversation, getMessagesByConversation } from "@/lib/db/repository";

const uuidSchema = z.uuid();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const parsed = uuidSchema.safeParse(sessionId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
  }

  try {
    const conversation = await getConversation(parsed.data);
    if (!conversation) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const messages = await getMessagesByConversation(conversation.id);
    return NextResponse.json({
      sessionId: conversation.id,
      messages: messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error("[GET /api/chat/:sessionId]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
