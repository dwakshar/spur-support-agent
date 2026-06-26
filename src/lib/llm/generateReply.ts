import { SYSTEM_PROMPT } from "./prompt";

export class LLMError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LLMError";
  }
}

type HistoryEntry = { sender: "user" | "ai"; text: string };

export async function generateReply(
  history: HistoryEntry[],
  userMessage: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new LLMError("ANTHROPIC_API_KEY is not set");

  // lazy import so this module never crashes at import time when the key is absent
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, timeout: 30_000 });

  // cap to last 10 history entries to keep context small and costs predictable
  const recentHistory = history.slice(-10);

  const messages: { role: "user" | "assistant"; content: string }[] = [
    ...recentHistory.map((m) => ({
      role: (m.sender === "ai" ? "assistant" : "user") as "user" | "assistant",
      content: m.text,
    })),
    { role: "user", content: userMessage },
  ];

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("");

    // empty reply is a model-side failure — treat it the same as an API error
    if (!text.trim()) throw new LLMError("Model returned an empty response");

    return text;
  } catch (err) {
    if (err instanceof LLMError) throw err;
    throw new LLMError("Anthropic API call failed", err);
  }
}
