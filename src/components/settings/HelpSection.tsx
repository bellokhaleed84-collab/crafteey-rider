"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

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
    a: "Your account is suspended from going online once your debt passes ₦8,000. Pay it off from your wallet or by card to be reinstated.",
  },
];

export default function HelpSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-4">
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-brand">Still need help?</p>
        {/* Placeholder address — point this at your real support inbox. */}
        <a
          href="mailto:support@crafteey.com"
          className="mt-3 block rounded-xl bg-brand py-2.5 text-center text-sm font-semibold text-white"
        >
          Email support
        </a>
      </div>
    </div>
  );
}