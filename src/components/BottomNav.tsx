"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Home", icon: "🏠" },
  { href: "/dashboard/earnings", label: "Earnings", icon: "💰" },
  { href: "/dashboard/activity", label: "Activity", icon: "📋" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-xs font-semibold ${
                active ? "text-brand-accent" : "text-slate-400"
              }`}
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}