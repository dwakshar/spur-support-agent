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
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.error ?? "Something went wrong. Please try again.",
      };
    }
    return { ok: true, reply: data.reply, sessionId: data.sessionId };
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
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.error ?? "Failed to load history.",
      };
    }
    return { ok: true, sessionId: data.sessionId, messages: data.messages };
  } catch {
    return { ok: false, status: 0, error: "Network error." };
  }
}
