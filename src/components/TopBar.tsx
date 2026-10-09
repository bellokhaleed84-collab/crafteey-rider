"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

// Logo on the left, notification bell on the far right.
export default function TopBar() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-slate-200 bg-white"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5">
        <Link href="/dashboard" className="flex items-center gap-2" aria-label="Crafteey home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/crafteey-logo-mark.png" alt="" className="h-8 w-8 object-contain" />
          <span className="text-base font-extrabold text-brand">Crafteey</span>
        </Link>
        <Link
          href="/dashboard/notifications"
          aria-label="Notifications"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-brand active:scale-95"
        >
          <Bell className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}