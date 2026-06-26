"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MessageBubble from "./components/MessageBubble";
import TypingIndicator from "./components/TypingIndicator";
import { sendMessage, getHistory } from "@/lib/api";
import styles from "./chat.module.css";

type UIMessage = {
  id: string;
  sender: "user" | "ai";
  text: string;
};

const GREETING: UIMessage = {
  id: "greeting",
  sender: "ai",
  text: "Hi! I'm the Northpeak support assistant. Ask me about shipping, returns, or our support hours.",
};

const SESSION_KEY = "northpeak_session_id";

export default function ChatPage() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // restore session or show greeting
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) {
      setMessages([GREETING]);
      setHydrated(true);
      return;
    }

    getHistory(stored).then((result) => {
      if (result.ok && result.messages.length > 0) {
        setSessionId(stored);
        setMessages(
          result.messages.map((m) => ({
            id: m.id,
            sender: m.sender,
            text: m.text,
          }))
        );
      } else {
        if (!result.ok && result.status === 404) {
          localStorage.removeItem(SESSION_KEY);
        }
        setMessages([GREETING]);
      }
      setHydrated(true);
    });
  }, []);

  // scroll to bottom on new messages or typing indicator
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: UIMessage = {
      id: crypto.randomUUID(),
      sender: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const result = await sendMessage(trimmed, sessionId);
    setIsLoading(false);

    if (result.ok) {
      if (!sessionId) {
        localStorage.setItem(SESSION_KEY, result.sessionId);
        setSessionId(result.sessionId);
      }
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), sender: "ai", text: result.reply },
      ]);
    } else {
      if (result.status === 404) {
        localStorage.removeItem(SESSION_KEY);
        setSessionId(undefined);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          sender: "ai",
          text: result.error,
        },
      ]);
    }
  }, [input, isLoading, sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // auto-resize textarea
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <span className={styles.storeName}>Northpeak Support</span>
          <div className={styles.statusGroup}>
            <span className={styles.statusDot} />
            <span className={styles.statusLabel}>Online</span>
          </div>
        </header>

        {!hydrated ? (
          <div className={styles.initPlaceholder}>Loading…</div>
        ) : (
          <div className={styles.messageList}>
            {messages.map((m) => (
              <MessageBubble key={m.id} sender={m.sender} text={m.text} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}

        <div className={styles.inputRow}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            rows={1}
            placeholder="Message Northpeak support…"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={isLoading || !hydrated}
          />
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={isLoading || !hydrated || !input.trim()}
            aria-label="Send message"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path
                d="M7.5 13V2M3 6.5L7.5 2L12 6.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
