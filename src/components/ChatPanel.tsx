"use client";

import ReactMarkdown from "react-markdown";
import { useCallback, useEffect, useRef, useState } from "react";
import { CitationList } from "./CitationList";
import type { Citation } from "@/lib/db";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  created_at: string;
};

const SUGGESTIONS = [
  "Summarize the key themes across my sources",
  "What are the main arguments or claims?",
  "List open questions the sources don't answer",
  "Compare how different sources treat this topic",
];

const LAN_DEMO = process.env.NEXT_PUBLIC_HAWKCHAT_LAN_DEMO === "true";

export function ChatPanel({ notebookId }: { notebookId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/messages`);
      if (!res.ok) {
        setMessages([]);
        return;
      }
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      setMessages([]);
    }
  }, [notebookId]);

  useEffect(() => {
    fetch("/api/client/session").finally(() => {
      loadMessages();
    });
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setInput("");

    const optimisticUser: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmed,
      citations: null,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimisticUser]);

    try {
      const res = await fetch(`/api/notebooks/${notebookId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chat failed");

      setMessages((m) => [
        ...m.filter((msg) => msg.id !== optimisticUser.id),
        {
          id: data.userMessage.id,
          role: "user",
          content: data.userMessage.content,
          citations: null,
          created_at: data.userMessage.created_at,
        },
        {
          id: data.assistantMessage.id,
          role: "assistant",
          content: data.assistantMessage.content,
          citations: data.assistantMessage.citations,
          created_at: data.assistantMessage.created_at,
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m.filter((msg) => msg.id !== optimisticUser.id),
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            err instanceof Error
              ? err.message
              : "Something went wrong. Check your API key.",
          citations: null,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-hawk-900/50">
      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl pt-8 text-center">
            <span className="hawk-badge mb-4">
              {LAN_DEMO ? "WORLD CUP 2026" : "ASK YOUR SOURCES"}
            </span>
            <h2 className="font-display mb-2 text-2xl font-bold uppercase tracking-wide text-hawk-50">
              Start a conversation
            </h2>
            <p className="mb-8 text-hawk-300">
              {LAN_DEMO
                ? "Ask anything about this notebook's documents. Citations list each source once."
                : "Upload documents on the left, then chat. Answers cite your material."}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={sending}
                  className="hawk-btn-secondary px-4 py-2 text-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={
                  msg.role === "user"
                    ? "ml-8 rounded-2xl border border-orange/30 bg-orange/10 px-4 py-3 shadow-hawk-glow"
                    : "mr-4"
                }
              >
                {msg.role === "assistant" ? (
                  <div className="markdown-hawk max-w-none text-[15px] leading-relaxed">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                    {msg.citations && (
                      <CitationList citations={msg.citations} />
                    )}
                  </div>
                ) : (
                  <p className="text-[15px] text-hawk-50">{msg.content}</p>
                )}
              </div>
            ))}
            {sending && (
              <p className="animate-pulse text-sm text-orange">
                Reading your sources…
              </p>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form
        className="border-t border-hawk-600 bg-hawk-950/90 px-6 py-4 backdrop-blur-md"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your sources…"
            disabled={sending}
            className="hawk-input flex-1 rounded-xl px-4 py-3 text-[15px]"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="hawk-btn-primary rounded-xl px-5 py-3 text-sm disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
