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
      checkActiveThenLoadQueue();
    } finally {
      setAcceptingId(null);
    }
  }

  // ---- OFFLINE VIEW (unchanged layout, button now has a pulse cue) ----
  if (!isOnline) {
    return (
      <div className="space-y-4 pb-4">
        <div>
          <h1 className="text-lg font-bold text-brand">You're offline</h1>
          <p className="text-sm text-steel">Ready to go?</p>
        </div>

        <MapOrFallback courierLocation={location} className="h-56 w-full rounded-2xl" />

        <button
          onClick={handleToggleOnline}
          disabled={togglingOnline}
          className="w-full rounded-xl bg-brand-accent py-3 text-sm font-bold text-white transition-transform duration-150 active:scale-95 disabled:opacity-60 disabled:[animation:none]"
          style={{ animation: togglingOnline ? "none" : "go-online-pulse 2.2s ease-in-out infinite" }}
        >
          {togglingOnline ? "Please wait…" : "Go online"}
        </button>

        {error && <p className="text-sm text-red-600">{error}</p>}

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

  // ---- ONLINE VIEW: full map + searching indicator + bottom sheet ----
  const topRequest = requests[0] ?? null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="relative flex-1">
        <MapOrFallback courierLocation={location} className="h-full w-full" />

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

        {!topRequest && (
          <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-3">
            <div className="relative h-2 w-40 overflow-hidden rounded-full bg-white/40">
              <div
                className="absolute top-0 h-2 w-16 rounded-full bg-brand-accent"
                style={{ animation: "searching-scan 1.6s ease-in-out infinite" }}
              />
            </div>
            <p className="rounded-full bg-white/90 px-4 py-1.5 text-xs font-semibold text-steel shadow">
              Searching for deliveries…
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="bg-red-50 px-4 py-2 text-center text-sm text-red-600">{error}</p>
      )}

      {topRequest && (
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