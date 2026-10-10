"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Summary = { average: number; count: number };

export function Stars({ value, size = "h-4 w-4" }: { value: number; size?: string }) {
  return (
    <span className="flex gap-0.5" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
        />
      ))}
    </span>
  );
}

// How customers rate this rider. Tap to see every rating.
export default function RatingSummaryCard() {
  const { getIdToken } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await fetch("/api/couriers/ratings?summary=1", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) throw new Error("failed");
        if (!cancelled) setSummary({ average: data.average ?? 0, count: data.count ?? 0 });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  if (failed) return null;

  if (!summary) {
    return <div className="h-20 animate-pulse rounded-2xl bg-slate-200" aria-busy="true" />;
  }

  return (
    <Link
      href="/dashboard/ratings"
      className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 active:scale-[0.99]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sunshine/30">
        <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
      </span>
      <div className="min-w-0 flex-1">
        {summary.count > 0 ? (
          <>
            <div className="flex items-center gap-2">
              <p className="text-xl font-extrabold text-brand">{summary.average.toFixed(1)}</p>
              <Stars value={summary.average} />
            </div>
            <p className="text-xs text-steel">
              {summary.count} {summary.count === 1 ? "rating" : "ratings"} from customers
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-brand">No ratings yet</p>
            <p className="text-xs text-steel">Customers can rate you after each delivery.</p>
          </>
        )}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-steel" />
    </Link>
  );
}