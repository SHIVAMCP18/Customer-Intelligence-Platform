"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SentimentBadge } from "@/components/ui/badge";

type Source = {
  n: number;
  id: string;
  content: string;
  sentiment: string | null;
  themeName: string | null;
  channelName: string | null;
  createdAt: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  error?: boolean;
};

type StreamEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

const SUGGESTED_QUESTIONS = [
  "What are the most common pain points?",
  "Which themes need urgent attention?",
  "Summarize the overall customer sentiment.",
  "What features are customers requesting most?",
];

const STORAGE_KEY = "voiceiq-chat";

// "[3]" -> a link the markdown renderer turns into a citation chip. Leaves
// real markdown links ("[text](url)") alone.
function linkCitations(text: string): string {
  return text.replace(/\[(\d{1,2})\](?!\()/g, "[$1](#cite-$1)");
}

function SparkleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 002.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
      />
    </svg>
  );
}

function SourceList({
  sources,
  highlighted,
  messageId,
}: {
  sources: Source[];
  highlighted: number | null;
  messageId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (sources.length === 0) return null;
  // Always show a highlighted citation, even if it's beyond the first three.
  const visible = expanded ? sources : sources.filter((s, i) => i < 3 || s.n === highlighted);

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Sources · {sources.length} feedback items
      </p>
      <ul className="space-y-1.5">
        {visible.map((s) => (
          <li
            key={s.id}
            id={`${messageId}-source-${s.n}`}
            className={`rounded-lg border px-3 py-2 text-xs transition-colors duration-300 ${
              highlighted === s.n ? "border-primary bg-primary-soft/60" : "border-border bg-surface"
            }`}
          >
            <div className="mb-1 flex flex-wrap items-center gap-1.5 text-muted-foreground">
              <span className="font-mono font-semibold text-primary">[{s.n}]</span>
              {s.sentiment && <SentimentBadge sentiment={s.sentiment} />}
              {s.themeName && <span className="truncate">· {s.themeName}</span>}
              {s.channelName && <span>· {s.channelName}</span>}
              <span>· {new Date(s.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="line-clamp-3 text-foreground/90">{s.content}</p>
          </li>
        ))}
      </ul>
      {sources.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-medium text-primary hover:text-primary-hover"
        >
          {expanded ? "Show fewer" : `Show all ${sources.length} sources`}
        </button>
      )}
    </div>
  );
}

function AssistantMessage({ message, streaming }: { message: Message; streaming: boolean }) {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="group w-full">
      <div
        className={`prose prose-sm max-w-none dark:prose-invert prose-headings:mb-1 prose-headings:mt-3 prose-headings:font-semibold prose-p:my-1.5 prose-ol:my-1 prose-ul:my-1 prose-li:my-0.5 prose-table:text-xs prose-th:border prose-th:border-border prose-th:px-2 prose-th:py-1 prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1 ${
          message.error ? "text-red-600 dark:text-red-400" : ""
        }`}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              const match = href?.match(/^#cite-(\d+)$/);
              if (match) {
                const n = Number(match[1]);
                if (!message.sources?.some((s) => s.n === n)) return <span>[{children}]</span>;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      setHighlighted(n);
                      requestAnimationFrame(() =>
                        document
                          .getElementById(`${message.id}-source-${n}`)
                          ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                      );
                    }}
                    className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-primary-soft px-1 align-text-top font-mono text-[10px] font-semibold text-primary-soft-foreground no-underline transition-colors hover:bg-primary hover:text-primary-foreground"
                    aria-label={`Show source ${n}`}
                  >
                    {n}
                  </button>
                );
              }
              return (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              );
            },
          }}
        >
          {linkCitations(message.content)}
        </ReactMarkdown>
        {streaming && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary align-middle" />
        )}
      </div>

      {!streaming && message.sources && (
        <SourceList sources={message.sources} highlighted={highlighted} messageId={message.id} />
      )}

      {!streaming && message.content && !message.error && (
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(message.content);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              // Clipboard blocked -- nothing useful to do.
            }
          }}
          className="mt-2 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100"
        >
          {copied ? "Copied" : "Copy answer"}
        </button>
      )}
    </div>
  );
}

export function FeedbackChat({ orgId, feedbackCount }: { orgId: string; feedbackCount: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const storageKey = `${STORAGE_KEY}:${orgId}`;

  // Keep the conversation across navigation within the tab (per org).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) setMessages(JSON.parse(saved) as Message[]);
    } catch {
      // Storage unavailable (private mode) -- start fresh.
    }
  }, [storageKey]);

  useEffect(() => {
    if (streamingId) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
    } catch {
      // ignore
    }
  }, [messages, streamingId, storageKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, searching]);

  const busy = streamingId !== null;

  function updateMessage(id: string, update: (m: Message) => Message) {
    setMessages((prev) => prev.map((m) => (m.id === id ? update(m) : m)));
  }

  function handleEvent(assistantId: string, event: StreamEvent) {
    if (event.type === "sources") {
      setSearching(false);
      updateMessage(assistantId, (m) => ({ ...m, sources: event.sources }));
    } else if (event.type === "delta") {
      setSearching(false);
      updateMessage(assistantId, (m) => ({ ...m, content: m.content + event.text }));
    } else if (event.type === "error") {
      updateMessage(assistantId, (m) => ({ ...m, content: event.message, error: true }));
    }
  }

  async function sendMessage(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput("");

    const history = messages
      .filter((m) => !m.error && m.content)
      .map((m) => ({ role: m.role, content: m.content }));
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: question },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setStreamingId(assistantId);
    setSearching(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, history }),
        signal: controller.signal,
      });

      if (res.status === 401) {
        window.location.href = "/login?next=/chat";
        return;
      }
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) handleEvent(assistantId, JSON.parse(line) as StreamEvent);
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        updateMessage(assistantId, (m) => ({ ...m, content: m.content || "_Stopped._" }));
      } else {
        updateMessage(assistantId, (m) => ({
          ...m,
          content: error instanceof Error ? error.message : "Couldn't reach the assistant.",
          error: true,
        }));
      }
    } finally {
      setSearching(false);
      setStreamingId(null);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  function newChat() {
    abortRef.current?.abort();
    setMessages([]);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Grounded in {feedbackCount.toLocaleString()} feedback items
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={newChat}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            New chat
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-6 py-10 text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"
            >
              <SparkleIcon className="h-7 w-7" />
            </motion.div>
            <div>
              <p className="text-lg font-semibold text-foreground">Ask your customers anything</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Answers are grounded in your own feedback, and every claim links back to the items it came from.
              </p>
            </div>
            <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendMessage(q)}
                  className="rounded-xl border border-border bg-background px-4 py-3 text-left text-sm text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:text-foreground hover:shadow-sm"
                >
                  {q}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <SparkleIcon className="h-4 w-4" />
                </div>
              )}
              {msg.role === "user" ? (
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {msg.content}
                </div>
              ) : (
                <div className="min-w-0 max-w-[90%] rounded-2xl rounded-tl-sm border border-border bg-background px-4 py-3 text-sm">
                  {msg.id === streamingId && searching && !msg.content ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                      <span className="text-xs">Searching feedback…</span>
                    </div>
                  ) : (
                    <AssistantMessage message={msg} streaming={msg.id === streamingId} />
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="border-t border-border p-3 sm:p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
        >
          <textarea
            ref={inputRef}
            id="chat-input"
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask about your customer feedback…"
            aria-label="Your question"
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-1.5 text-sm text-foreground [field-sizing:content] placeholder:text-muted-foreground focus:outline-none"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="h-2.5 w-2.5 rounded-sm bg-current" /> Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              id="chat-send-button"
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary-hover disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </button>
          )}
        </form>
        <p className="mt-1.5 hidden text-center text-[11px] text-muted-foreground sm:block">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}
