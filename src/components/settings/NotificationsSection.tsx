"use client";

import { useEffect, useState } from "react";

const KEY = "crafteey_rider_notification_prefs";

interface Prefs {
  newRequests: boolean;
  earningsUpdates: boolean;
  promotions: boolean;
}

const DEFAULT_PREFS: Prefs = { newRequests: true, earningsUpdates: true, promotions: false };

const ROWS: { key: keyof Prefs; label: string; description: string }[] = [
  { key: "newRequests", label: "New delivery requests", description: "Get alerted when a new request comes in." },
  { key: "earningsUpdates", label: "Earnings updates", description: "Payout confirmations and debt reminders." },
  { key: "promotions", label: "Promotions", description: "Bonus offers and referral updates." },
];

export default function NotificationsSection() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved) setPrefs(JSON.parse(saved));
  }, []);

  function toggle(key: keyof Prefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  return (
    <div className="space-y-3">
      {ROWS.map((r) => (
        <div
          key={r.key}
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"
        >
          <div>
            <p className="text-sm font-semibold text-brand">{r.label}</p>
            <p className="mt-0.5 text-xs text-steel">{r.description}</p>
          </div>
          <button
            onClick={() => toggle(r.key)}
            className={`h-6 w-11 shrink-0 rounded-full transition-colors ${
              prefs[r.key] ? "bg-emerald-500" : "bg-slate-200"
            }`}
          >
            <span
              className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition-transform ${
                prefs[r.key] ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      ))}
      <p className="text-[11px] text-steel">
        Saved on this device only — actual push notifications need Firebase Cloud Messaging wired up server-side,
        which isn't built yet.
      </p>
    </div>
  );
}