"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

export default function SettingsPageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/settings"
          aria-label="Back to settings"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-brand"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-bold text-brand">{title}</h1>
      </div>
      {children}
    </div>
  );
}