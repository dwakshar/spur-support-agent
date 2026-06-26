import {
  createConversation,
  getConversation,
  insertMessage,
  getMessagesByConversation,
} from "@/lib/db/repository";
import { generateReply } from "@/lib/llm/generateReply";

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = "SessionNotFoundError";
  }
}

export interface InboundMessage {
  channel: "web_chat";
  sessionId?: string;
  text: string;
}

export interface OutboundResult {
  reply: string;
  sessionId: string;
}

export async function handleInboundMessage(
  msg: InboundMessage
): Promise<OutboundResult> {
  // 1. resolve or create conversation
  let conversation;
  if (msg.sessionId) {
    conversation = await getConversation(msg.sessionId);
    if (!conversation) throw new SessionNotFoundError(msg.sessionId);
  } else {
    conversation = await createConversation(msg.channel);
  }

  // 2. capture prior history before inserting new message
  const priorMessages = await getMessagesByConversation(conversation.id);
  const priorHistory = priorMessages.map((m) => ({
    sender: m.sender,
    text: m.text,
  }));

  // 3. persist user message first so it's never lost even if LLM fails
  await insertMessage(conversation.id, "user", msg.text);

  // 4. call LLM — throws LLMError on failure, caller maps it to a friendly response
  const reply = await generateReply(priorHistory, msg.text);

  // 5. persist AI reply
  await insertMessage(conversation.id, "ai", reply);

  return { reply, sessionId: conversation.id };
}
