"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { COURIER_ACCOUNT_STATUS, REQUIRE_COURIER_APPROVAL } from "@/lib/constants";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading, getIdToken, signOut } = useAuth();
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

  return (
    <div className="min-h-screen bg-concrete">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
        <span className="font-display text-lg font-bold text-brand">Crafteey Rider</span>
        <button
          onClick={() => {
            signOut();
            router.replace("/login");
          }}
          className="text-sm font-semibold text-steel"
        >
          Log out
        </button>
      </header>
      <main className="mx-auto max-w-lg px-5 py-6">{children}</main>
    </div>
  );
}