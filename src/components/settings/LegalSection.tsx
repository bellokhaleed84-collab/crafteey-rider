"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

// Starter text. This will be managed from the admin app later.
const TERMS: { title: string; body: string[] }[] = [
  {
    title: "About these terms",
    body: [
      "These terms apply when you use the Crafteey Rider app to accept and complete deliveries.",
      "By going online and accepting requests, you agree to them.",
    ],
  },
  {
    title: "Your account",
    body: [
      "Give true details and keep them up to date. Keep your login private and do not share your account.",
      "Crafteey can suspend or close an account that breaks these terms.",
    ],
  },
  {
    title: "Deliveries",
    body: [
      "Accept only the deliveries you can complete. Pick up and deliver each package as shown in the app.",
      "Never open, use, swap or keep a package. Use the vehicle type you registered with.",
    ],
  },
  {
    title: "Payments and fees",
    body: [
      "For Hub orders, the customer pays in the app and your share is paid into your wallet.",
      "For direct rides, you collect the fare from the customer. Crafteey's commission is added to your debt.",
      "You must keep your debt below the limit shown in the app to stay online.",
    ],
  },
  {
    title: "Cash and transfers",
    body: [
      "Only confirm a payment in the app after you have really received the money.",
      "Do not ask customers to pay you outside the app for Hub orders.",
    ],
  },
  {
    title: "Safety and conduct",
    body: [
      "Follow traffic laws and wear protective gear. Treat customers and vendors with respect.",
      "No harassment, fraud, or carrying illegal items.",
    ],
  },
  {
    title: "Location and privacy",
    body: [
      "We use your location while you are online to match you with requests and to show customers where you are.",
      "See Privacy & security in Settings for more.",
    ],
  },
  {
    title: "Suspension",
    body: [
      "We may suspend your account for unpaid debt, unsafe behaviour, fraud, or repeated complaints.",
    ],
  },
  {
    title: "Changes to these terms",
    body: [
      "We may update these terms from time to time. Using the app after a change means you accept it.",
    ],
  },
  {
    title: "Questions",
    body: ["Use Help & support in Settings and we will get back to you."],
  },
];

export default function LegalSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-2">
      {TERMS.map((t, i) => (
        <div key={t.title} className="rounded-2xl border border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="flex min-h-[28px] w-full items-center justify-between gap-3 text-left"
          >
            <p className="text-sm font-semibold text-brand">
              {i + 1}. {t.title}
            </p>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-steel transition-transform ${open === i ? "rotate-180" : ""}`}
            />
          </button>
          {open === i && (
            <div className="mt-2 space-y-2">
              {t.body.map((line) => (
                <p key={line} className="text-xs leading-relaxed text-steel">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}