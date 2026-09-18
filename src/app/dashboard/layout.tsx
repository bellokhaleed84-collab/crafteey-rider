"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { COURIER_ACCOUNT_STATUS, REQUIRE_COURIER_APPROVAL } from "@/lib/constants";
import BottomNav from "@/components/BottomNav";
import { RiderStatusProvider } from "@/contexts/RiderStatusContext";

// Full-screen routes render their own back arrow and chrome — they
// shouldn't get the bottom nav or the padded container, since they're
// meant to feel like a distinct screen rather than a tab.
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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-steel">Loading…</p>
      </div>
    );
  }

  const isFullscreen = FULLSCREEN_ROUTES.includes(pathname);

  return (
    <RiderStatusProvider>
      <div className={`min-h-screen bg-concrete ${isFullscreen ? "" : "pb-20"}`}>
        {isFullscreen ? (
          children
        ) : (
          <main className="mx-auto max-w-lg px-5 py-6">{children}</main>
        )}
        {!isFullscreen && <BottomNav />}
      </div>
    </RiderStatusProvider>
  );
}