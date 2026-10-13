"use client";

/**
 * Chat thread UI: history, streaming ask, citations, thumbs feedback.
 * Debug message load/send, disabled chat banner, or feedback POST failures —
 * notebook-scoped via `/api/notebooks/[id]/messages` (and related).
 */
import ReactMarkdown from "react-markdown";
import { useCallback, useEffect, useRef, useState } from "react";
import { CitationList } from "./CitationList";
import type { Citation } from "@/lib/db";
import type { MessageFeedback } from "@/lib/message-feedback";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  created_at: string;
  feedback?: MessageFeedback | null;
};

function canRateMessage(id: string): boolean {
  return !id.startsWith("temp-") && !id.startsWith("err-");
}

function MessageFeedbackButtons({
  notebookId,
  messageId,
  feedback,
  onFeedback,
  jiraEnabled,
  onOpenJira,
  jiraBusy,
  jiraResult,
}: {
  notebookId: string;
  messageId: string;
  feedback?: MessageFeedback | null;
  onFeedback: (value: MessageFeedback) => void;
  jiraEnabled: boolean;
  onOpenJira: () => void;
  jiraBusy: boolean;
  jiraResult: string | null;
}) {
  const [submitting, setSubmitting] = useState(false);

  if (!canRateMessage(messageId)) return null;

  async function submit(value: MessageFeedback) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/notebooks/${notebookId}/messages/${messageId}/feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: value }),
        },
      );
      if (!res.ok) return;
      onFeedback(value);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-hawk-700 pt-3">
      {feedback ? (
        <p
          className={`text-xs ${
            feedback === "helpful" ? "text-emerald-300" : "text-hawk-400"
          }`}
        >
          {feedback === "helpful"
            ? "Thanks — marked as helpful."
            : "Thanks — marked as not helpful."}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-hawk-400">Was this helpful?</span>
          <button
            type="button"
            onClick={() => submit("helpful")}
            disabled={submitting}
            className="hawk-btn-secondary px-3 py-1 text-xs disabled:opacity-60"
          >
            This helped
          </button>
          <button
            type="button"
            onClick={() => submit("not_helpful")}
            disabled={submitting}
            className="hawk-btn-secondary px-3 py-1 text-xs disabled:opacity-60"
          >
            This didn&apos;t help
          </button>
        </div>
      )}

      {jiraEnabled && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenJira}
            disabled={jiraBusy}
            className="hawk-btn-secondary px-3 py-1 text-xs disabled:opacity-60"
          >
            {jiraBusy ? "Opening ticket…" : "Open Jira ticket"}
          </button>
          {jiraResult && (
            <span className="text-xs text-hawk-300">{jiraResult}</span>
          )}
        </div>
      )}
    </div>
  );
}

const SUGGESTIONS = [
  "Summarize the key themes across my sources",
  "What are the main arguments or claims?",
  "List open questions the sources don't answer",
  "Compare how different sources treat this topic",
];

const LAN_DEMO = process.env.NEXT_PUBLIC_HAWKCHAT_LAN_DEMO === "true";

export function ChatPanel({
  notebookId,
  notebookTitle,
  eventSlug,
  eventTitle,
  chatDisabled = false,
  chatDisabledReason,
}: {
  notebookId: string;
  notebookTitle?: string;
  eventSlug?: string | null;
  eventTitle?: string | null;
  chatDisabled?: boolean;
  chatDisabledReason?: string | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [jiraEnabled, setJiraEnabled] = useState(false);
  const [jiraBusyId, setJiraBusyId] = useState<string | null>(null);
  const [jiraResults, setJiraResults] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/jira")
      .then((r) => r.json())
      .then((data) => setJiraEnabled(Boolean(data.enabled)))
      .catch(() => setJiraEnabled(false));
  }, []);

  async function openJiraTicket(assistantMessage: Message, index: number) {
    if (jiraBusyId) return;
    const prior = [...messages]
      .slice(0, index)
      .reverse()
      .find((m) => m.role === "user");
    const question = prior?.content?.trim();
    if (!question) {
      setJiraResults((prev) => ({
        ...prev,
        [assistantMessage.id]: "No question found above this answer.",
      }));
      return;
    }

    setJiraBusyId(assistantMessage.id);
    setJiraResults((prev) => ({ ...prev, [assistantMessage.id]: "" }));
    try {
      const res = await fetch("/api/jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          answer: assistantMessage.content,
          notebookId,
          notebookTitle: notebookTitle ?? "",
          eventSlug: eventSlug ?? "",
          eventTitle: eventTitle ?? "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setJiraResults((prev) => ({
          ...prev,
          [assistantMessage.id]: data.error ?? "Could not create ticket.",
        }));
        return;
      }
      const key = data.issue?.key as string | undefined;
      const url = data.issue?.url as string | undefined;
      const epicKey = data.issue?.epicKey as string | undefined;
      setJiraResults((prev) => ({
        ...prev,
        [assistantMessage.id]: key
          ? `Created ${key}${epicKey ? ` under ${epicKey}` : ""}`
          : "Ticket created.",
      }));
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      setJiraResults((prev) => ({
        ...prev,
        [assistantMessage.id]: "Could not create ticket.",
      }));
    } finally {
      setJiraBusyId(null);
    }
  }

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
    if (!trimmed || sending || chatDisabled) return;

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
          feedback: null,
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
                  disabled={sending || chatDisabled}
                  className="hawk-btn-secondary px-4 py-2 text-sm disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
            {messages.map((msg, index) => (
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
                    <MessageFeedbackButtons
                      notebookId={notebookId}
                      messageId={msg.id}
                      feedback={msg.feedback}
                      onFeedback={(value) =>
                        setMessages((prev) =>
                          prev.map((m) =>
                            m.id === msg.id ? { ...m, feedback: value } : m,
                          ),
                        )
                      }
                      jiraEnabled={jiraEnabled}
                      onOpenJira={() => openJiraTicket(msg, index)}
                      jiraBusy={jiraBusyId === msg.id}
                      jiraResult={jiraResults[msg.id] ?? null}
                    />
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
        {chatDisabled && (
          <p className="mx-auto mb-3 max-w-2xl rounded-lg border border-hawk-600 bg-hawk-900/80 px-4 py-3 text-sm text-hawk-200">
            {chatDisabledReason ??
              "This project is not active. You can browse notebooks but cannot ask new questions."}
          </p>
        )}
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              chatDisabled
                ? "Questions are closed for this project"
                : "Ask a question about your sources…"
            }
            disabled={sending || chatDisabled}
            className="hawk-input flex-1 rounded-xl px-4 py-3 text-[15px] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || chatDisabled || !input.trim()}
            className="hawk-btn-primary rounded-xl px-5 py-3 text-sm disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
