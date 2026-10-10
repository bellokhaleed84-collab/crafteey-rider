"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Inbox, MessageCircle } from "lucide-react";

const FAQS = [
  {
    q: "How do Hub delivery earnings work?",
    a: "The client pays in-app; your 80% share goes to your wallet and pays out on the next Monday or Thursday.",
  },
  {
    q: "How do direct-ride earnings work?",
    a: "The client pays you the full fare in cash; the platform's 20% commission is added to your debt instead of being deducted upfront.",
  },
  {
    q: "When can I withdraw my wallet balance?",
    a: "Withdrawals are available every Monday and Thursday, once your bank details are added.",
  },
  {
    q: "What happens if my debt gets too high?",
    a: "Your account is suspended from going online once your debt passes \u20A68,000. Pay it off from your wallet or by card to be reinstated.",
  },
  {
    q: "The customer is not answering. What do I do?",
    a: "Open the menu on your active delivery and tap Report a problem. It shows who to call. Wait at the location.",
  },
];

export default function HelpSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Link
          href="/dashboard/support/report"
          className="flex min-h-[64px] items-center gap-3 px-4 py-3 active:bg-slate-50"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-brand">Talk to support</span>
            <span className="block text-xs text-steel">Tell us what went wrong. We will chat with you.</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-steel" />
        </Link>
        <Link
          href="/dashboard/support/tickets"
          className="flex min-h-[64px] items-center gap-3 border-t border-slate-100 px-4 py-3 active:bg-slate-50"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
            <Inbox className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-brand">My support chats</span>
            <span className="block text-xs text-steel">See replies and the status of your reports.</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-steel" />
        </Link>
      </div>

      <div className="space-y-2">
        {FAQS.map((f, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between text-left"
            >
              <p className="text-sm font-semibold text-brand">{f.q}</p>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-steel transition-transform ${open === i ? "rotate-180" : ""}`}
              />
            </button>
            {open === i && <p className="mt-2 text-xs text-steel">{f.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}