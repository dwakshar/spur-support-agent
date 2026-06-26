export type ChatMessage = {
  id: string;
  sender: "user" | "ai";
  text: string;
  createdAt: string;
};

type SendOk = { ok: true; reply: string; sessionId: string };
type SendErr = { ok: false; status: number; error: string };
export type SendResult = SendOk | SendErr;

type HistoryOk = { ok: true; sessionId: string; messages: ChatMessage[] };
type HistoryErr = { ok: false; status: number; error: string };
export type HistoryResult = HistoryOk | HistoryErr;

async function parseJSON(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    // server returned non-JSON (e.g. an unexpected HTML error page)
    return {};
  }
}

export async function sendMessage(
  message: string,
  sessionId?: string
): Promise<SendResult> {
  try {
    const res = await fetch("/api/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId }),
    });
    const data = await parseJSON(res);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof data.error === "string"
          ? data.error
          : "Something went wrong. Please try again.",
      };
    }
    return {
      ok: true,
      reply: typeof data.reply === "string" ? data.reply : "",
      sessionId: typeof data.sessionId === "string" ? data.sessionId : "",
    };
  } catch {
    return {
      ok: false,
      status: 0,
      error: "Network error. Please check your connection.",
    };
  }
}

export async function getHistory(sessionId: string): Promise<HistoryResult> {
  try {
    const res = await fetch(`/api/chat/${sessionId}`);
    const data = await parseJSON(res);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof data.error === "string" ? data.error : "Failed to load history.",
      };
    }
    return {
      ok: true,
      sessionId: typeof data.sessionId === "string" ? data.sessionId : "",
      messages: Array.isArray(data.messages) ? (data.messages as ChatMessage[]) : [],
    };
  } catch {
    return { ok: false, status: 0, error: "Network error." };
  }
}
