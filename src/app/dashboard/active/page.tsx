"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import RouteMap from "@/components/map/RouteMap";
import { useGeolocation, type LatLng } from "@/hooks/useGeolocation";
import { geocodeAddress } from "@/lib/geocode";
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

  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<LatLng | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

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

  const requestId = request?._id;

  // Once the rider has marked pickup complete, the map's job shifts from
  // "get to pickup" to "get to drop-off" — so that's also the point we
  // start resolving drop-off coordinates.
  const showDropoff = !!request && request.status !== COURIER_STATUS.ACCEPTED;

  // Resolve pickup coordinates as soon as the request loads. Prefer the
  // lat/lng crafteey-client already sent; only geocode the address string
  // as a fallback for requests created without coordinates.
  useEffect(() => {
    if (!request) return;
    if (request.pickupLat != null && request.pickupLng != null) {
      setPickupCoords({ lat: request.pickupLat, lng: request.pickupLng });
      return;
    }
    let cancelled = false;
    geocodeAddress(request.pickup).then((coords) => {
      if (cancelled) return;
      if (coords) setPickupCoords(coords);
      else setGeocodeError("Couldn't locate the pickup address on the map.");
    });
    return () => {
      cancelled = true;
    };
  }, [request?.pickup, request?.pickupLat, request?.pickupLng]);

  // Only resolve drop-off coordinates once pickup is done — no point
  // geocoding it earlier since it isn't shown yet.
  useEffect(() => {
    if (!showDropoff || !request) return;
    if (request.dropoffLat != null && request.dropoffLng != null) {
      setDropoffCoords({ lat: request.dropoffLat, lng: request.dropoffLng });
      return;
    }
    let cancelled = false;
    geocodeAddress(request.dropoff).then((coords) => {
      if (cancelled) return;
      if (coords) setDropoffCoords(coords);
      else setGeocodeError("Couldn't locate the drop-off address on the map.");
    });
    return () => {
      cancelled = true;
    };
  }, [showDropoff, request?.dropoff, request?.dropoffLat, request?.dropoffLng]);

  // Share live location while a delivery is in progress — throttled to
  // once every 8s so we're not hammering the API on every GPS tick.
  const geo = useGeolocation({
    onThrottledUpdate: async (coords: LatLng) => {
      if (!requestId) return;
      const token = await getIdToken();
      if (!token) return;
      fetch(`/api/courier-requests/${requestId}/location`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lat: coords.lat, lng: coords.lng }),
      }).catch(() => {
        // A dropped location ping isn't worth surfacing an error for —
        // the next tick will just try again.
      });
    },
  });

  useEffect(() => {
    if (!requestId) return;
    geo.start();
    return () => geo.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

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

  const displayError = geo.error ?? geocodeError ?? error;

  return (
    <div className="space-y-4">
      <RouteMap
        pickup={showDropoff ? null : pickupCoords}
        dropoff={showDropoff ? dropoffCoords : null}
        courierLocation={geo.location}
        className="h-[45vh] w-full rounded-2xl border border-slate-200"
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <span className="inline-block rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
          {STATUS_LABEL[request.status] ?? request.status}
        </span>

        {geo.permissionState === "denied" && (
          <p className="mt-3 text-xs text-red-600">
            Location sharing is off — the client won't see your live position
            until you enable location access.
          </p>
        )}

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

        {displayError && geo.permissionState !== "denied" && (
          <p className="mt-3 text-sm text-red-600">{displayError}</p>
        )}

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