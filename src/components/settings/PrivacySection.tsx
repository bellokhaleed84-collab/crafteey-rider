"use client";

import Link from "next/link";

const BLOCKS: { title: string; icon: string; lines: string[] }[] = [
  {
    title: "Your location",
    icon: "\uD83D\uDCCD",
    lines: [
      "We use your location while you are online, to match you with nearby deliveries.",
      "During a delivery, the customer can see where you are on the map. When you go offline, sharing stops.",
    ],
  },
  {
    title: "What we keep",
    icon: "\uD83D\uDDC2\uFE0F",
    lines: [
      "Your name, phone number, vehicle details and ID number, to verify your account.",
      "Your deliveries, earnings, payments and chat messages with customers, so we can show your history and sort out complaints.",
      "Your bank account details, only to pay out your earnings.",
    ],
  },
  {
    title: "Your phone permissions",
    icon: "\uD83D\uDCF1",
    lines: [
      "You can turn location off in your phone Settings. You will not be able to go online without it.",
      "Never share your login. Crafteey will never ask for your password.",
    ],
  },
  {
    title: "Your account",
    icon: "\uD83D\uDD11",
    lines: [
      "To delete your account and data, contact Help & support. Pay any debt first. Money records may be kept as the law requires.",
    ],
  },
];

export default function PrivacySection() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-steel">A simple summary of how your information is used.</p>

      {BLOCKS.map((b) => (
        <div key={b.title} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg">
              {b.icon}
            </span>
            <p className="text-sm font-bold text-brand">{b.title}</p>
          </div>
          <div className="mt-3 space-y-2">
            {b.lines.map((l) => (
              <p key={l} className="text-xs leading-relaxed text-steel">
                {l}
              </p>
            ))}
          </div>
        </div>
      ))}

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/dashboard/settings/legal"
          className="rounded-xl border border-slate-200 bg-white py-3 text-center text-sm font-semibold text-brand"
        >
          Terms
        </Link>
        <Link
          href="/dashboard/settings/help"
          className="rounded-xl border border-slate-200 bg-white py-3 text-center text-sm font-semibold text-brand"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}