"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface QueueRequest {
  _id: string;
  pickup: string;
  dropoff: string;
  note: string;
  createdAt: string;
}

export default function QueuePage() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const [requests, setRequests] = useState<QueueRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkActiveThenLoadQueue = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;

    // If this courier already has an active delivery, send them there
    // instead of showing the queue — they can't accept a second job.
    const activeRes = await fetch("/api/courier-requests/active", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const activeData = await activeRes.json();
    if (activeData.request) {
      router.replace("/dashboard/active");
      return;
    }

    const queueRes = await fetch("/api/courier-requests/queue", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (queueRes.ok) {
      const data = await queueRes.json();
      setRequests(data.requests ?? []);
    }
    setLoading(false);
  }, [getIdToken, router]);

  useEffect(() => {
    checkActiveThenLoadQueue();
    // Poll every 6s so new requests show up without a manual refresh.
    const interval = setInterval(checkActiveThenLoadQueue, 6000);
    return () => clearInterval(interval);
  }, [checkActiveThenLoadQueue]);

  async function handleAccept(id: string) {
    setError(null);
    setAcceptingId(id);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/courier-requests/${id}/accept`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't accept this request.");
      }
      router.push("/dashboard/active");
    } catch (err: any) {
      setError(err.message || "Couldn't accept this request.");
      // Someone else may have taken it — refresh the list either way.
      checkActiveThenLoadQueue();
    } finally {
      setAcceptingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-steel">Loading queue…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-brand">Available deliveries</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-steel">No delivery requests right now.</p>
          <p className="mt-1 text-xs text-slate-400">This list updates automatically.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r._id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-400">Pickup</p>
              <p className="text-sm font-semibold text-brand">{r.pickup}</p>
              <p className="mt-2 text-xs font-semibold text-slate-400">Drop-off</p>
              <p className="text-sm font-semibold text-brand">{r.dropoff}</p>
              {r.note && <p className="mt-2 text-sm text-steel">{r.note}</p>}
              <button
                onClick={() => handleAccept(r._id)}
                disabled={acceptingId === r._id}
                className="mt-4 w-full rounded-xl bg-brand-accent py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {acceptingId === r._id ? "Accepting…" : "Accept delivery"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
