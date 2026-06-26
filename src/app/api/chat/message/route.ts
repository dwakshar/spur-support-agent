import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleInboundMessage, SessionNotFoundError } from "@/lib/channels/core";
import { LLMError } from "@/lib/llm/generateReply";

const bodySchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, { error: "Message cannot be empty" })
    .max(4000, { error: "Message is too long (max 4000 characters)" }),
  sessionId: z.uuid().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { message, sessionId } = parsed.data;

  try {
    const result = await handleInboundMessage({
      channel: "web_chat",
      text: message,
      sessionId,
    });
    return NextResponse.json({ reply: result.reply, sessionId: result.sessionId });
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      return NextResponse.json(
        { error: "Session not found. Starting a new chat." },
        { status: 404 }
      );
    }
    if (err instanceof LLMError) {
      return NextResponse.json(
        { error: "Sorry, our assistant is temporarily unavailable. Please try again in a moment." },
        { status: 502 }
      );
    }
    console.error("[POST /api/chat/message]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
