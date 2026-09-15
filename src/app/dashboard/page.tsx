"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import type { LatLng } from "@/hooks/useGeolocation";
import { useGeolocation } from "@/hooks/useGeolocation";
import MapOrFallback from "@/components/map/MapOrFallback";

interface QueueRequest {
  _id: string;
  pickup: string;
  dropoff: string;
  note: string;
  createdAt: string;
}

export default function DashboardHomePage() {
  const router = useRouter();
  const { getIdToken } = useAuth();

  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);

  const [requests, setRequests] = useState<QueueRequest[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendPresence(next: boolean, coords?: LatLng | null) {
    const token = await getIdToken();
    if (!token) return;
    await fetch("/api/couriers/online", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isOnline: next, location: coords ?? null }),
    }).catch(() => {});
  }

  // Foundation piece: one shared geolocation hook instead of a hand-rolled
  // watchPosition call. onThrottledUpdate sends the presence ping at the
  // same ~8s cadence the old code used.
  const geo = useGeolocation({
    onThrottledUpdate: (coords) => sendPresence(true, coords),
  });

  // Load the courier's current online state on mount so a page refresh
  // doesn't silently flip them offline in the UI while the DB still
  // thinks they're online.
  useEffect(() => {
    (async () => {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch("/api/couriers/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.courier?.isOnline) {
          setIsOnline(true);
          geo.start();
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkActiveThenLoadQueue = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;

    // If this courier already has an active delivery, send them there —
    // they can't accept a second job.
    const activeRes = await fetch("/api/courier-requests/active", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const activeData = await activeRes.json().catch(() => ({}));
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
    setLoadingQueue(false);
  }, [getIdToken, router]);

  // Only poll the queue while online.
  useEffect(() => {
    if (!isOnline) {
      setRequests([]);
      return;
    }
    setLoadingQueue(true);
    checkActiveThenLoadQueue();
    const interval = setInterval(checkActiveThenLoadQueue, 6000);
    return () => clearInterval(interval);
  }, [isOnline, checkActiveThenLoadQueue]);

  async function handleToggleOnline() {
    setError(null);
    setTogglingOnline(true);
    try {
      if (isOnline) {
        geo.stop();
        await sendPresence(false);
        setIsOnline(false);
      } else {
        setIsOnline(true);
        geo.start();
        await sendPresence(true, geo.location);
      }
    } finally {
      setTogglingOnline(false);
    }
  }

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

  // The hook's own error (permission denied, GPS unavailable, etc.) takes
  // priority over a generic action error since it explains *why* nothing
  // else is working.
  const displayError = geo.error ?? error;

  // ---- OFFLINE VIEW ----
  if (!isOnline) {
    return (
      <div className="space-y-4 pb-4">
        <div>
          <h1 className="text-lg font-bold text-brand">You're offline</h1>
          <p className="text-sm text-steel">Ready to go?</p>
        </div>

        <MapOrFallback courierLocation={geo.location} className="h-56 w-full rounded-2xl" />

        <button
          onClick={handleToggleOnline}
          disabled={togglingOnline}
          className="w-full rounded-xl bg-brand-accent py-3 text-sm font-bold text-white transition-transform duration-150 active:scale-95 disabled:opacity-60 disabled:[animation:none]"
          style={{ animation: togglingOnline ? "none" : "go-online-pulse 2.2s ease-in-out infinite" }}
        >
          {togglingOnline ? "Please wait…" : "Go online"}
        </button>

        {geo.permissionState === "denied" && (
          <p className="text-sm text-red-600">
            Location access is turned off for this app. Enable it in your
            browser/device settings, then try going online again.
          </p>
        )}
        {displayError && geo.permissionState !== "denied" && (
          <p className="text-sm text-red-600">{displayError}</p>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-brand">Peak hours</p>
          <p className="mt-1 text-xs text-steel">
            Demand near you is usually highest in the evenings. Go online to
            start seeing live delivery requests.
          </p>
        </div>
      </div>
    );
  }

  // ---- ONLINE VIEW: full map + bottom-docked searching/request panel ----
  const topRequest = requests[0] ?? null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="relative flex-1">
        <MapOrFallback courierLocation={geo.location} className="h-full w-full" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-brand shadow">
            🟢 Online
          </span>
          <button
            onClick={handleToggleOnline}
            disabled={togglingOnline}
            className="rounded-full bg-white/90 px-4 py-1.5 text-xs font-semibold text-slate-700 shadow transition-transform duration-150 active:scale-95 disabled:opacity-60"
          >
            {togglingOnline ? "…" : "Go offline"}
          </button>
        </div>
      </div>

      {displayError && (
        <p className="bg-red-50 px-4 py-2 text-center text-sm text-red-600">{displayError}</p>
      )}

      {!topRequest ? (
        <div className="rounded-t-3xl border-t border-slate-200 bg-white px-5 py-6 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" />
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-2 w-40 overflow-hidden rounded-full bg-slate-100">
              <div
                className="absolute top-0 h-2 w-16 rounded-full bg-brand-accent"
                style={{ animation: "searching-scan 1.6s ease-in-out infinite" }}
              />
            </div>
            <p className="text-sm font-semibold text-steel">Searching for deliveries…</p>
          </div>
        </div>
      ) : (
        <div
          key={topRequest._id}
          className="rounded-t-3xl border-t border-slate-200 bg-white p-5 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
          style={{ animation: "sheet-slide-up 0.35s ease-out" }}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
          <p className="text-xs font-semibold text-slate-400">New delivery request</p>
          <p className="mt-2 text-xs font-semibold text-slate-400">Pickup</p>
          <p className="text-sm font-semibold text-brand">{topRequest.pickup}</p>
          <p className="mt-2 text-xs font-semibold text-slate-400">Drop-off</p>
          <p className="text-sm font-semibold text-brand">{topRequest.dropoff}</p>
          {topRequest.note && <p className="mt-2 text-sm text-steel">{topRequest.note}</p>}
          <button
            onClick={() => handleAccept(topRequest._id)}
            disabled={acceptingId === topRequest._id}
            className="mt-4 w-full rounded-xl bg-brand-accent py-3 text-sm font-bold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
          >
            {acceptingId === topRequest._id ? "Accepting…" : "Accept delivery"}
          </button>
        </div>
      )}
    </div>
  );
}