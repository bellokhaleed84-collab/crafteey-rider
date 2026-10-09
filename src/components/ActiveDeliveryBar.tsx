"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useRiderStatus } from "@/contexts/RiderStatusContext";

// Shown on every page except the delivery screen while the rider has a
// delivery in progress. One tap takes them back to it.
export default function ActiveDeliveryBar() {
  const pathname = usePathname();
  const { activeRequestId, refreshActive } = useRiderStatus();
  const onActivePage = pathname.startsWith("/dashboard/active");

  // Re-check right away when the rider lands on another page, so the bar
  // disappears quickly after a delivery is finished.
  useEffect(() => {
    if (!onActivePage) void refreshActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!activeRequestId || onActivePage) return null;

  return (
    <>
      {/* Keeps the end of the page from hiding behind the bar */}
      <div className="h-16" aria-hidden="true" />
      <Link
        href="/dashboard/active"
        className="fixed inset-x-3 bottom-[72px] z-40 mx-auto flex min-h-[56px] max-w-lg items-center gap-3 rounded-2xl bg-brand-accent px-4 py-3 text-white shadow-lg active:scale-[0.98]"
      >
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold">Delivery in progress</span>
          <span className="block text-xs text-white/80">Tap to go back to your delivery</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0" />
      </Link>
    </>
  );
}