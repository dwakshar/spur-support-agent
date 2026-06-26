import { eq, asc } from "drizzle-orm";
import { db } from "./client";
import { conversations, messages } from "./schema";
import type { NewConversation } from "./schema";

export async function createConversation(
  channel: NewConversation["channel"] = "web_chat"
) {
  const [row] = await db.insert(conversations).values({ channel }).returning();
  return row;
}

export async function getConversation(id: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id));
  return row ?? null;
}

export async function insertMessage(
  conversationId: string,
  sender: "user" | "ai",
  text: string
) {
  const [row] = await db
    .insert(messages)
    .values({ conversationId, sender, text })
    .returning();
  return row;
}

export async function getMessagesByConversation(conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
}
