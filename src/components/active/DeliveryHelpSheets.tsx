"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import type { LatLng } from "@/hooks/useGeolocation";
import { GIVE_UP_REASONS, PROBLEM_REASONS } from "@/lib/reportReasons";

type GetToken = () => Promise<string | null>;

async function send(
  getIdToken: GetToken,
  method: "POST" | "PATCH",
  path: string,
  body: unknown
): Promise<void> {
  const token = await getIdToken();
  if (!token) throw new Error("You're not signed in.");
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
}

function SheetShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/50" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300" />
        <h2 className="text-lg font-extrabold text-brand">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ReasonList({
  reasons,
  value,
  onChange,
}: {
  reasons: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-4 space-y-2">
      {reasons.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`flex min-h-[52px] w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-transform duration-150 active:scale-[0.99] ${
            value === r ? "border-brand-accent bg-brand-accent/10 text-brand" : "border-slate-200 text-slate-700"
          }`}
        >
          <span>{r}</span>
          {value === r && <Check className="h-5 w-5 shrink-0 text-brand-accent" />}
        </button>
      ))}
    </div>
  );
}

function DoneView({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sunshine">
        <Check className="h-8 w-8" strokeWidth={3} style={{ color: "#15181F" }} />
      </span>
      <p className="mt-4 text-lg font-extrabold text-brand">{title}</p>
      <p className="mt-1 text-sm text-steel">{text}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 min-h-[52px] w-full rounded-xl bg-sunshine py-3.5 text-sm font-extrabold"
        style={{ color: "#15181F" }}
      >
        Back to delivery
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------
// Report a problem (the delivery carries on)
// ----------------------------------------------------------------------
export function ProblemSheet({
  requestId,
  getIdToken,
  location,
  onClose,
}: {
  requestId: string;
  getIdToken: GetToken;
  location: LatLng | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    try {
      await send(getIdToken, "POST", `/api/courier-requests/${requestId}/report`, {
        kind: "problem",
        reason,
        note: note.trim(),
        location,
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message || "Couldn't send the report.");
    } finally {
      setSending(false);
    }
  }

  return (
    <SheetShell title="Report a problem" onClose={onClose}>
      {done ? (
        <DoneView
          title="Report sent"
          text="Crafteey has your report. You can carry on with the delivery."
          onClose={onClose}
        />
      ) : (
        <>
          <p className="mt-1 text-sm text-steel">What is going wrong? The delivery stays open.</p>
          <ReasonList reasons={PROBLEM_REASONS} value={reason} onChange={setReason} />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Add a note (optional)"
            className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-brand"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={!reason || sending}
            className="mt-4 min-h-[56px] w-full rounded-xl bg-brand-accent py-3.5 text-base font-bold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send report"}
          </button>
        </>
      )}
    </SheetShell>
  );
}

// ----------------------------------------------------------------------
// Give the job back (only before pickup)
// ----------------------------------------------------------------------
export function GiveUpSheet({
  requestId,
  getIdToken,
  onClose,
  onDone,
}: {
  requestId: string;
  getIdToken: GetToken;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    try {
      await send(getIdToken, "PATCH", `/api/courier-requests/${requestId}/release`, { reason });
      onDone();
    } catch (e: any) {
      setError(e.message || "Couldn't give the job back.");
      setSending(false);
    }
  }

  return (
    <SheetShell title="Give up this job?" onClose={onClose}>
      <p className="mt-1 text-sm text-steel">
        The job goes back to other riders and you won&apos;t be offered it again. You can only do this before you
        pick up.
      </p>
      <ReasonList reasons={GIVE_UP_REASONS} value={reason} onChange={setReason} />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={!reason || sending}
        className="mt-4 min-h-[56px] w-full rounded-xl bg-red-600 py-3.5 text-base font-bold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-50"
      >
        {sending ? "Giving back..." : "Give job back"}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 min-h-[52px] w-full rounded-xl py-3 text-sm font-semibold text-steel"
      >
        Keep the job
      </button>
    </SheetShell>
  );
}

// ----------------------------------------------------------------------
// Emergency
// ----------------------------------------------------------------------
export function EmergencySheet({
  requestId,
  getIdToken,
  location,
  onClose,
}: {
  requestId: string;
  getIdToken: GetToken;
  location: LatLng | null;
  onClose: () => void;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const mapLink = location ? `https://www.google.com/maps?q=${location.lat},${location.lng}` : "";
  const smsBody = location ? `I need help. My location: ${mapLink}` : "I need help.";
  const smsHref = `sms:?body=${encodeURIComponent(smsBody)}`;

  async function alertCrafteey() {
    if (state !== "idle") return;
    setState("sending");
    setError(null);
    try {
      await send(getIdToken, "POST", `/api/courier-requests/${requestId}/report`, {
        kind: "emergency",
        location,
      });
      setState("sent");
    } catch (e: any) {
      setError(e.message || "Couldn't send the alert.");
      setState("idle");
    }
  }

  return (
    <SheetShell title="Emergency" onClose={onClose}>
      <p className="mt-1 text-sm text-steel">If you are in danger, call 112 first.</p>

      <a
        href="tel:112"
        className="mt-4 flex min-h-[64px] w-full items-center justify-center rounded-2xl bg-red-600 text-xl font-extrabold text-white transition-transform duration-150 active:scale-[0.98]"
      >
        Call 112
      </a>

      <button
        type="button"
        onClick={alertCrafteey}
        disabled={state !== "idle"}
        className="mt-3 min-h-[56px] w-full rounded-xl bg-brand-accent py-3.5 text-base font-bold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
      >
        {state === "sending" ? "Sending..." : state === "sent" ? "Alert sent to Crafteey" : "Alert Crafteey"}
      </button>
      {state === "sent" && (
        <p className="mt-2 text-sm font-semibold text-emerald-600">
          Crafteey has your alert{location ? " and your live location" : ""}.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <a
        href={smsHref}
        className="mt-3 flex min-h-[56px] w-full items-center justify-center rounded-xl border border-slate-200 text-base font-semibold text-slate-700 transition-transform duration-150 active:scale-[0.98]"
      >
        Text my location
      </a>

      <p className="mt-4 text-xs text-slate-400">
        Crafteey may not see the alert right away. If you are in danger, call 112.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="mt-3 min-h-[52px] w-full rounded-xl py-3 text-sm font-semibold text-steel"
      >
        Close
      </button>
    </SheetShell>
  );
}