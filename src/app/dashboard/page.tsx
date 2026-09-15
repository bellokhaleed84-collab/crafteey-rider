
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import type { LatLng } from "@/components/map/RouteMap";
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
  const [location, setLocation] = useState<LatLng | null>(null);

  const [requests, setRequests] = useState<QueueRequest[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);

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
        if (data.courier?.isOnline) setIsOnline(true);
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

  function startWatchingLocation() {
    if (!navigator.geolocation || watchIdRef.current !== null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(coords);
        const now = Date.now();
        if (now - lastSentRef.current > 8000) {
          lastSentRef.current = now;
          sendPresence(true, coords);
        }
      },
      () => setError("Couldn't get your location. Enable location access to go online."),
      { enableHighAccuracy: true }
    );
  }

  function stopWatchingLocation() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }

  // Stop the geolocation watch if the user navigates away entirely.
  useEffect(() => stopWatchingLocation, []);

  async function handleToggleOnline() {
    setError(null);
    setTogglingOnline(true);
    try {
      if (isOnline) {
        stopWatchingLocation();
        await sendPresence(false);
        setIsOnline(false);
        setLocation(null);
      } else {
        setIsOnline(true);
        startWatchingLocation();
        await sendPresence(true, location);
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

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-lg font-bold text-brand">
          {isOnline ? "You're online" : "You're offline"}
        </h1>
        <p className="text-sm text-steel">
          {isOnline ? "Looking for deliveries near you." : "Ready to go?"}
        </p>
      </div>

      <MapOrFallback courierLocation={location} className="h-56 w-full rounded-2xl" />

      <button
        onClick={handleToggleOnline}
        disabled={togglingOnline}
        className={`w-full rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60 ${
          isOnline ? "bg-slate-700" : "bg-brand-accent"
        }`}
      >
        {togglingOnline ? "Please wait…" : isOnline ? "Go offline" : "Go online"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!isOnline ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-brand">Peak hours</p>
          <p className="mt-1 text-xs text-steel">
            Demand near you is usually highest in the evenings. Go online to
            start seeing live delivery requests.
          </p>
        </div>
      ) : loadingQueue ? (
        <p className="text-sm text-steel">Loading queue…</p>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-steel">No delivery requests right now.</p>
          <p className="mt-1 text-xs text-slate-400">This list updates automatically.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-brand">Available deliveries</p>
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