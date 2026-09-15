"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { COURIER_ACCOUNT_STATUS, REQUIRE_COURIER_APPROVAL } from "@/lib/constants";

export default function HomePage() {
  const router = useRouter();
  const { user, loading, getIdToken } = useAuth();

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
          router.replace("/dashboard");
        } else {
          router.replace("/pending");
        }
      } catch {
        router.replace("/login");
      }
    })();
  }, [user, loading, router, getIdToken]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-steel">Loading…</p>
    </div>
  );
}