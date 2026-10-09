"use client";

import Link from "next/link";
import { Bell, ChevronLeft } from "lucide-react";

// Placeholder until push notifications are built. Shows a clean empty state.
export default function NotificationsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-brand"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-bold text-brand">Notifications</h1>
      </div>

      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-steel">
          <Bell className="h-8 w-8" />
        </span>
        <p className="mt-4 text-base font-bold text-brand">No notifications yet</p>
        <p className="mt-1 text-xs text-steel">Delivery alerts and updates from Crafteey will show here.</p>
      </div>
    </div>
  );
}