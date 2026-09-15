"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import RouteMap, { type LatLng } from "@/components/map/RouteMap";
import { COURIER_STATUS } from "@/lib/constants";

interface ActiveRequest {
  _id: string;
  pickup: string;
  dropoff: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  note: string;
  status: string;
  clientName: string;
  clientPhone: string;
}

const STATUS_LABEL: Record<string, string> = {
  [COURIER_STATUS.ACCEPTED]: "Heading to pickup",
  [COURIER_STATUS.PICKED_UP]: "Picked up",
  [COURIER_STATUS.EN_ROUTE]: "On the way to drop-off",
};

const NEXT_ACTION_LABEL: Record<string, string> = {
  [COURIER_STATUS.ACCEPTED]: "Mark as picked up",
  [COURIER_STATUS.PICKED_UP]: "Start heading to drop-off",
  [COURIER_STATUS.EN_ROUTE]: "Mark as delivered",
};

export default function ActiveDeliveryPage() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const [request, setRequest] = useState<ActiveRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myLocation, setMyLocation] = useState<LatLng | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);

  const loadActive = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch("/api/courier-requests/active", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (!data.request) {
        router.replace("/dashboard");
        return;
      }
      setRequest(data.request);
    }
    setLoading(false);
  }, [getIdToken, router]);

  useEffect(() => {
    loadActive();
    const interval = setInterval(loadActive, 8000);
    return () => clearInterval(interval);
  }, [loadActive]);

  // Share live location while a delivery is in progress — throttled to
  // roughly once every 8s so we're not hammering the API on every GPS
  // tick, which can fire multiple times a second.
  useEffect(() => {
    if (!request || !navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setMyLocation({ lat: latitude, lng: longitude });

        const now = Date.now();
        if (now - lastSentRef.current < 8000) return;
        lastSentRef.current = now;

        const token = await getIdToken();
        if (!token) return;
        fetch(`/api/courier-requests/${request._id}/location`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ lat: latitude, lng: longitude }),
        }).catch(() => {
          // A dropped location ping isn't worth surfacing an error for —
          // the next watchPosition tick will just try again.
        });
      },
      () => {
        // Permission denied or unavailable — the delivery can still
        // proceed without live tracking, just without the map updating.
      },
      { enableHighAccuracy: true }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [request, getIdToken]);

  async function handleAdvance() {
    if (!request) return;
    setError(null);
    setAdvancing(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/courier-requests/${request._id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't update status.");
      }
      const data = await res.json();
      if (data.request.status === COURIER_STATUS.DELIVERED) {
        router.replace("/dashboard");
      } else {
        setRequest(data.request);
      }
    } catch (err: any) {
      setError(err.message || "Couldn't update status.");
    } finally {
      setAdvancing(false);
    }
  }

  if (loading || !request) {
    return <p className="text-sm text-steel">Loading…</p>;
  }

  const pickupCoords: LatLng | null =
    request.pickupLat != null && request.pickupLng != null
      ? { lat: request.pickupLat, lng: request.pickupLng }
      : null;
  const dropoffCoords: LatLng | null =
    request.dropoffLat != null && request.dropoffLng != null
      ? { lat: request.dropoffLat, lng: request.dropoffLng }
      : null;

  return (
    <div className="space-y-4">
      <RouteMap
        pickup={pickupCoords}
        dropoff={dropoffCoords}
        courierLocation={myLocation}
        className="h-[45vh] w-full rounded-2xl border border-slate-200"
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <span className="inline-block rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
          {STATUS_LABEL[request.status] ?? request.status}
        </span>

        <p className="mt-4 text-xs font-semibold text-slate-400">Pickup</p>
        <p className="text-sm font-semibold text-brand">{request.pickup}</p>
        <p className="mt-3 text-xs font-semibold text-slate-400">Drop-off</p>
        <p className="text-sm font-semibold text-brand">{request.dropoff}</p>
        {request.note && (
          <>
            <p className="mt-3 text-xs font-semibold text-slate-400">Note</p>
            <p className="text-sm text-steel">{request.note}</p>
          </>
        )}

        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-400">Client</p>
          <p className="text-sm font-semibold text-brand">{request.clientName}</p>
          <a
            href={`tel:${request.clientPhone}`}
            className="mt-1 inline-block text-sm font-semibold text-brand-accent underline underline-offset-2"
          >
            Call {request.clientPhone}
          </a>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          onClick={handleAdvance}
          disabled={advancing}
          className="mt-5 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {advancing ? "Updating…" : NEXT_ACTION_LABEL[request.status] ?? "Update status"}
        </button>
      </div>
    </div>
  );
}
