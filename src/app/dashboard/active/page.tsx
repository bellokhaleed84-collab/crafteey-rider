"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import RouteMap from "@/components/map/RouteMap";
import { useGeolocation, type LatLng } from "@/hooks/useGeolocation";
import { geocodeAddress } from "@/lib/geocode";
import {
  getRoute,
  formatDuration,
  formatDistance,
  distanceMeters,
  distanceToRouteMeters,
  type RouteResult,
} from "@/lib/directions";
import { NAVIGATION_STAGES } from "@/lib/navigationStages";
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

// How often we're willing to re-hit the Directions API on a timer while
// the destination hasn't changed and the rider hasn't strayed off-route.
const ROUTE_REFRESH_MS = 20000;
// If the rider's live position is more than this far from the last known
// route line, treat it as a real deviation and recalculate immediately,
// bypassing the timer above.
const DEVIATION_THRESHOLD_METERS = 60;
// Close enough to a pickup/dropoff point to consider the rider "arrived".
const ARRIVAL_THRESHOLD_METERS = 60;

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

  const [route, setRoute] = useState<RouteResult | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const routeRef = useRef<RouteResult | null>(null);
  const lastRouteFetchRef = useRef(0);
  const lastRouteDestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

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

  // Status is the single source of truth for what stage of navigation
  // we're in — the map, route target, labels, and button all read from
  // this rather than separate ad-hoc checks.
  const stage = request ? NAVIGATION_STAGES[request.status] : undefined;
  const showDropoff = stage?.destination === "dropoff";
  const destination = showDropoff ? dropoffCoords : pickupCoords;

  // Resolve pickup coordinates as soon as the request loads.
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

  // Only resolve drop-off coordinates once pickup is done.
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

  // Share live location while a delivery is in progress.
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
      }).catch(() => {});
    },
  });

  useEffect(() => {
    if (!requestId) return;
    geo.start();
    return () => geo.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  // Recalculate the route on a timer, immediately when the destination
  // changes, or immediately if the rider has strayed off the current
  // route line (deviation) rather than waiting for the timer.
  useEffect(() => {
    if (!geo.location || !destination) {
      setRoute(null);
      setRecalculating(false);
      return;
    }

    const destKey = `${destination.lat},${destination.lng}`;
    const now = Date.now();
    const destChanged = destKey !== lastRouteDestKeyRef.current;

    let deviated = false;
    if (!destChanged && routeRef.current) {
      const dist = distanceToRouteMeters(geo.location, routeRef.current.geometry.coordinates);
      deviated = dist > DEVIATION_THRESHOLD_METERS;
    }

    const dueForRefresh = now - lastRouteFetchRef.current >= ROUTE_REFRESH_MS;
    if (!destChanged && !deviated && !dueForRefresh) return;

    lastRouteDestKeyRef.current = destKey;
    lastRouteFetchRef.current = now;
    if (deviated) setRecalculating(true);

    let cancelled = false;
    getRoute(geo.location, destination).then((result) => {
      if (cancelled) return;
      if (result) setRoute(result);
      setRecalculating(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.location?.lat, geo.location?.lng, destination?.lat, destination?.lng]);

  // Arrival detection — straight-line distance from the rider to whichever
  // point (pickup or drop-off) is currently the target.
  const hasArrived =
    !!geo.location && !!destination && distanceMeters(geo.location, destination) <= ARRIVAL_THRESHOLD_METERS;

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
        // New stage, new destination — don't wait for the throttle.
        lastRouteFetchRef.current = 0;
        lastRouteDestKeyRef.current = null;
      }
    } catch (err: any) {
      setError(err.message || "Couldn't update status.");
    } finally {
      setAdvancing(false);
    }
  }

  if (loading || !request || !stage) {
    return <p className="text-sm text-steel">Loading…</p>;
  }

  const displayError = geo.error ?? geocodeError ?? error;

  return (
    <div className="space-y-4">
      <div className="relative">
        <RouteMap
          pickup={showDropoff ? null : pickupCoords}
          dropoff={showDropoff ? dropoffCoords : null}
          courierLocation={geo.location}
          route={route?.geometry}
          className="h-[45vh] w-full rounded-2xl border border-slate-200"
        />
        {route && (
          <div className="absolute left-3 top-3 rounded-xl bg-white/95 px-3 py-2 shadow">
            <p className="text-sm font-bold text-brand">{formatDuration(route.durationSeconds)}</p>
            <p className="text-xs text-steel">{formatDistance(route.distanceMeters)}</p>
          </div>
        )}
        {recalculating && (
          <div className="absolute right-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow">
            Recalculating route…
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <span className="inline-block rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
          {stage.statusLabel}
        </span>

        {hasArrived && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            📍 {stage.arrivedLabel}
          </p>
        )}

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
          className="mt-5 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-60 disabled:[animation:none]"
          style={{ animation: hasArrived && !advancing ? "arrival-pulse 2s ease-in-out infinite" : "none" }}
        >
          {advancing ? "Updating…" : stage.nextActionLabel}
        </button>
      </div>
    </div>
  );
}