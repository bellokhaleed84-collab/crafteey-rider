"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Stars } from "@/components/RatingSummaryCard";

type ReviewItem = { id: string; name: string; rating: number; comment: string; createdAt: string };
type Summary = { average: number; count: number; distribution: Record<string, number> };

function day(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Lagos" }).format(new Date(iso));
}

export default function RatingsPage() {
  const { getIdToken } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (before: string | null) => {
      const token = await getIdToken();
      const qs = before ? `?before=${encodeURIComponent(before)}` : "";
      const res = await fetch(`/api/couriers/ratings${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || "Couldn't load your ratings.");
      return data;
    },
    [getIdToken]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPage(null);
        if (cancelled) return;
        setSummary({ average: data.average ?? 0, count: data.count ?? 0, distribution: data.distribution ?? {} });
        setReviews(data.reviews ?? []);
        setNextBefore(data.nextBefore ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load your ratings.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  async function loadMore() {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(nextBefore);
      setReviews((prev) => [...(prev ?? []), ...(data.reviews ?? [])]);
      setNextBefore(data.nextBefore ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load more ratings.");
    } finally {
      setLoadingMore(false);
    }
  }

  const back = (
    <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-accent">
      <ArrowLeft className="h-4 w-4" /> Back
    </Link>
  );

  if (error && !reviews) {
    return (
      <div className="space-y-4">
        {back}
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-600">
          {error}
        </p>
      </div>
    );
  }

  if (!summary || !reviews) {
    return (
      <div className="space-y-4" aria-busy="true">
        {back}
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  const maxBar = Math.max(1, ...Object.values(summary.distribution));

  return (
    <div className="space-y-4">
      {back}
      <h1 className="text-lg font-bold text-brand">My ratings</h1>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {summary.count === 0 ? (
          <p className="py-4 text-center text-sm text-steel">
            No ratings yet. Customers can rate you after each delivery.
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-4xl font-extrabold text-brand">{summary.average.toFixed(1)}</p>
              <Stars value={summary.average} />
              <p className="mt-1 text-xs text-steel">
                {summary.count} {summary.count === 1 ? "rating" : "ratings"}
              </p>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = summary.distribution[String(n)] ?? 0;
                return (
                  <div key={n} className="flex items-center gap-2 text-xs text-steel">
                    <span className="w-3 text-right">{n}</span>
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${(count / maxBar) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {reviews.length > 0 && (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4">
          {reviews.map((r) => (
            <div key={r.id} className="space-y-1.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-brand">{r.name}</p>
                <p className="text-xs text-steel">{day(r.createdAt)}</p>
              </div>
              <Stars value={r.rating} />
              {r.comment && <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-center text-xs text-red-600">{error}</p>}

      {nextBefore && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="min-h-11 w-full rounded-xl border border-slate-200 bg-white text-sm font-semibold text-brand disabled:opacity-50"
        >
          {loadingMore ? "Loading more\u2026" : "Load more"}
        </button>
      )}
    </div>
  );
}