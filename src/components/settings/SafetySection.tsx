"use client";

import Link from "next/link";
import { Phone } from "lucide-react";

const NUMBERS = [
  { label: "Emergency (all services)", note: "Police, ambulance and fire. Say which one you need.", number: "112", main: true },
  { label: "Lagos State emergency", note: "Lagos emergency response line", number: "767", main: false },
  { label: "Police", note: "Nigeria Police Force", number: "199", main: false },
  { label: "Road accident", note: "Federal Road Safety Corps", number: "122", main: false },
];

const GROUPS: { title: string; icon: string; tips: string[] }[] = [
  {
    title: "On the road",
    icon: "\uD83C\uDFCD\uFE0F",
    tips: [
      "Wear your helmet and reflective gear every time.",
      "Do not use your phone while moving. Stop safely first.",
      "Ride slower at night and when the road is wet.",
    ],
  },
  {
    title: "At pickup and drop-off",
    icon: "\uD83D\uDCE6",
    tips: [
      "Check the pickup and drop-off match the app before you take a package.",
      "Meet people in a well-lit, open place when you can.",
      "Never open a package or carry anything illegal.",
    ],
  },
  {
    title: "If something goes wrong",
    icon: "\u26A0\uFE0F",
    tips: [
      "Your safety comes first. Leave if a place or person feels unsafe.",
      "In danger or hurt? Call the emergency number above.",
      "Tell us afterwards through Help & support.",
    ],
  },
];

export default function SafetySection() {
  return (
    <div className="space-y-5">
      {/* Emergency numbers */}
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-base font-extrabold text-red-700">In an emergency, call now</p>
        <p className="mt-1 text-xs text-red-600">
          Tap a number to open your phone dialer. Normal call charges may apply.
        </p>

        <div className="mt-3 space-y-2">
          {NUMBERS.map((n) => (
            <a
              key={n.number}
              href={`tel:${n.number}`}
              className={`flex min-h-[64px] items-center gap-3 rounded-xl px-4 py-3 active:scale-[0.98] ${
                n.main ? "bg-red-600 text-white" : "border border-red-200 bg-white text-brand"
              }`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  n.main ? "bg-white/20" : "bg-red-50 text-red-600"
                }`}
              >
                <Phone className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{n.label}</span>
                <span className={`block text-xs ${n.main ? "text-white/80" : "text-steel"}`}>{n.note}</span>
              </span>
              <span className="text-xl font-extrabold">{n.number}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Safety tips */}
      {GROUPS.map((g) => (
        <div key={g.title} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sunshine text-lg">
              {g.icon}
            </span>
            <p className="text-sm font-bold text-brand">{g.title}</p>
          </div>
          <ul className="mt-3 space-y-2">
            {g.tips.map((t) => (
              <li key={t} className="flex gap-2 text-xs text-steel">
                <span className="text-brand-accent">{"\u2022"}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <Link
        href="/dashboard/settings/help"
        className="block rounded-xl bg-brand-accent py-3.5 text-center text-sm font-bold text-white"
      >
        Report a problem
      </Link>
    </div>
  );
}