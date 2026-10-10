"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Bike, Smartphone, User, HelpCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const OPTIONS: { value: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { value: "payment", label: "Payment or wallet", icon: CreditCard },
  { value: "ride", label: "A delivery", icon: Bike },
  { value: "app", label: "App not working", icon: Smartphone },
  { value: "account", label: "My account", icon: User },
  { value: "other", label: "Something else", icon: HelpCircle },
];

export default function RiderReportPage() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = !!category && message.trim().length >= 5 && !sending;

  async function submit() {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category, message: message.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        router.replace(`/dashboard/support/tickets/${data.id}`);
        return;
      }
      setError(data.error || "Couldn't send your report. Try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your report. Try again.");
    }
    setSending(false);
  }

  return (
    <div className="space-y-5 pb-4">
      <Link href="/dashboard/settings/help" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-accent">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div>
        <h1 className="text-lg font-bold text-brand">Talk to support</h1>
        <p className="text-sm text-steel">Tell us what went wrong. Our team will chat with you here.</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-brand">What is it about?</h2>
        <div className="grid grid-cols-2 gap-3">
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = category === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                aria-pressed={selected}
                className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center text-sm font-semibold transition active:scale-[0.98] ${
                  selected
                    ? "border-brand-accent bg-brand-accent/10 text-brand"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-brand">What happened?</h2>
        <textarea
          rows={5}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us in your own words"
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-brand outline-none focus:border-brand-accent"
        />
        <p className="text-xs text-steel">Please do not put passwords or card details here.</p>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!canSend}
        className="min-h-14 w-full rounded-2xl bg-brand-accent text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {sending ? "Sending..." : "Send to support"}
      </button>
    </div>
  );
}