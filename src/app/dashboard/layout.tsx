"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { COURIER_ACCOUNT_STATUS, REQUIRE_COURIER_APPROVAL } from "@/lib/constants";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import IncomingRequestBanner from "@/components/IncomingRequestBanner";
import ActiveDeliveryBar from "@/components/ActiveDeliveryBar";
import BubbleSync from "@/components/BubbleSync";
import { RiderStatusProvider } from "@/contexts/RiderStatusContext";

// Full-screen routes render their own back arrow and chrome - they
// shouldn't get the bottom nav, the top bar or the padded container,
// since they're meant to feel like a distinct screen rather than a tab.
const FULLSCREEN_ROUTES = ["/dashboard/online"];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, getIdToken } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch("/api/couriers/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          router.replace("/login");
          return;
        }

        const data = await res.json();

        if (!data.courier) {
          router.replace("/register");
        } else if (
          !REQUIRE_COURIER_APPROVAL ||
          data.courier.status === COURIER_ACCOUNT_STATUS.APPROVED
        ) {
          setChecking(false);
        } else {
          router.replace("/pending");
        }
      } catch {
        router.replace("/login");
      }
    })();
  }, [user, loading, router, getIdToken]);

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-concrete" aria-busy="true">
        <div className="h-14 animate-pulse bg-slate-200" />
        <div className="mx-auto max-w-lg space-y-4 px-5 py-6">
          <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
          <div className="aspect-square w-full animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  const isFullscreen = FULLSCREEN_ROUTES.includes(pathname);
  // The active delivery screen is a full-bleed map with its own top controls.
  const showTopBar = !isFullscreen && !pathname.startsWith("/dashboard/active");

  return (
    <RiderStatusProvider>
      <BubbleSync />
      <div className={`min-h-screen bg-concrete ${isFullscreen ? "" : "pb-20"}`}>
        {showTopBar && <TopBar />}
        {isFullscreen ? (
          children
        ) : (
          <main className="mx-auto max-w-lg px-5 py-6">{children}</main>
        )}
        {!isFullscreen && <ActiveDeliveryBar />}
        {!isFullscreen && <BottomNav />}
        <IncomingRequestBanner />
      </div>
    </RiderStatusProvider>
  );
}