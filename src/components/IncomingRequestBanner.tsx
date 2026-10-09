"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useRiderStatus } from "@/contexts/RiderStatusContext";

// Shows on every page except the online and active screens, so a rider who
// is online can browse the app and still not miss a delivery request.
export default function IncomingRequestBanner() {
  const pathname = usePathname();
  const { isOnline, topRequest } = useRiderStatus();

  if (!isOnline || !topRequest) return null;
  if (pathname.startsWith("/dashboard/online") || pathname.startsWith("/dashboard/active")) return null;

  const title = topRequest.vendorName || "New delivery request";
  const earn =
    typeof topRequest.riderEarningKobo === "number"
      ? `\u20A6${Math.round(topRequest.riderEarningKobo / 100).toLocaleString()}`
      : null;

  return (
    <Link
      href="/dashboard/online"
      className="fixed inset-x-3 z-[60] flex min-h-[64px] items-center gap-3 rounded-2xl bg-sunshine px-4 py-3 shadow-xl active:scale-[0.98]"
      style={{ top: "max(0.75rem, env(safe-area-inset-top))", color: "#15181F", animation: "sheet-slide-up 0.3s ease-out" }}
    >
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold">{title}</span>
        <span className="block truncate text-xs font-semibold opacity-70">
          {earn ? `You earn ${earn} \u2022 ` : ""}
          Tap to view and accept
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0" />
    </Link>
  );
}