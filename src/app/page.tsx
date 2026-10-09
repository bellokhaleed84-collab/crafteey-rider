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
    <div className="min-h-screen space-y-4 p-4">
      <div className="h-12 w-1/2 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />
      <div className="h-40 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
      <div className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
      <div className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}