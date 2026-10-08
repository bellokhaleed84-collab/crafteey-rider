"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";

// Identical copy in crafteey-client and crafteey-rider.
export type ChatRole = "client" | "courier";

export interface ChatMsg {
  _id: string;
  senderRole: ChatRole;
  text: string;
  createdAt: string;
}

const seenKey = (id: string) => `crafteey-chat-seen-${id}`;

function getSeen(id: string): number {
  try {
    return Number(localStorage.getItem(seenKey(id))) || 0;
  } catch {
    return 0;
  }
}

function markSeen(id: string, at: number) {
  try {
    localStorage.setItem(seenKey(id), String(at));
  } catch {
    // storage unavailable - unread dot just won't clear across reloads
  }
}

type TokenGetter = () => Promise<string | null>;

// Counts messages from the other side that arrived since the chat was last open.
export function useChatUnread(
  requestId: string | undefined,
  role: ChatRole,
  getIdToken: TokenGetter,
  enabled: boolean,
  open: boolean
): number {
  const [count, setCount] = useState(0);
  const tokenRef = useRef(getIdToken);
  tokenRef.current = getIdToken;

  useEffect(() => {
    if (!requestId || !enabled || open) {
      setCount(0);
      return;
    }
    let cancelled = false;

    async function check() {
      try {
        const token = await tokenRef.current();
        if (!token) return;
        const res = await fetch(`/api/courier-requests/${requestId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const seen = getSeen(requestId as string);
        const n = ((data.messages ?? []) as ChatMsg[]).filter(
          (m) => m.senderRole !== role && new Date(m.createdAt).getTime() > seen
        ).length;
        if (!cancelled) setCount(n);
      } catch {
        // a missed check is fine
      }
    }

    check();
    const t = setInterval(check, 6000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [requestId, role, enabled, open]);

  return count;
}

interface ChatSheetProps {
  requestId: string;
  role: ChatRole;
  title: string;
  subtitle?: string;
  getIdToken: TokenGetter;
  onClose: () => void;
}

export default function ChatSheet({
  requestId,
  role,
  title,
  subtitle = "Delivery chat",
  getIdToken,
  onClose,
}: ChatSheetProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<string | null>(null);
  const tokenRef = useRef(getIdToken);
  tokenRef.current = getIdToken;

  const merge = useCallback((incoming: ChatMsg[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m._id));
      const fresh = incoming.filter((m) => !seen.has(m._id));
      if (fresh.length === 0) return prev;
      return [...prev, ...fresh].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const token = await tokenRef.current();
      if (!token) return;
      const qs = lastRef.current ? `?after=${encodeURIComponent(lastRef.current)}` : "";
      const res = await fetch(`/api/courier-requests/${requestId}/messages${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.messages ?? []) as ChatMsg[];
      if (list.length > 0) lastRef.current = list[list.length - 1].createdAt;
      merge(list);
    } catch {
      // keep polling
    } finally {
      setLoaded(true);
    }
  }, [requestId, merge]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (messages.length > 0) {
      markSeen(requestId, new Date(messages[messages.length - 1].createdAt).getTime());
    }
  }, [messages, requestId]);

  async function send() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    try {
      const token = await tokenRef.current();
      if (!token) throw new Error("Please sign in again.");
      const res = await fetch(`/api/courier-requests/${requestId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't send that message.");
      const msg = data.message as ChatMsg;
      setText("");
      merge([msg]);
      if (!lastRef.current || msg.createdAt > lastRef.current) lastRef.current = msg.createdAt;
    } catch (err: any) {
      setError(err.message || "Couldn't send that message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-white dark:bg-slate-950">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-brand dark:text-white">{title}</p>
          <p className="text-xs text-steel">{subtitle}</p>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {!loaded ? (
          <p className="pt-6 text-center text-xs text-steel">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="pt-6 text-center text-xs text-steel">No messages yet. Say hello!</p>
        ) : (
          messages.map((m) => {
            const mine = m.senderRole === role;
            return (
              <div key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "rounded-br-md bg-brand-accent text-white"
                      : "rounded-bl-md bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p className={`mt-0.5 text-right text-[10px] ${mine ? "text-white/70" : "text-slate-400"}`}>
                    {new Date(m.createdAt).toLocaleTimeString("en-NG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 pb-1 text-xs text-red-600">{error}</p>}

      <div
        className="flex items-end gap-2 border-t border-slate-100 p-3 dark:border-slate-800"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <textarea
          rows={1}
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Type a message"
          className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!text.trim() || sending}
          aria-label="Send message"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-accent text-white transition active:scale-95 disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}