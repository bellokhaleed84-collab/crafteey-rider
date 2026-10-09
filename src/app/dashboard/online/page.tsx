"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Clock, MapPin, MessageSquare, Package, ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";
import MapOrFallback from "@/components/map/MapOrFallback";
import { useRiderStatus } from "@/contexts/RiderStatusContext";
import { getRoute, type RouteGeometry } from "@/lib/directions";

const VEHICLE_ICON: Record<string, string> = {
  bicycle: "\uD83D\uDEB2",
  motorcycle: "\uD83C\uDFCD\uFE0F",
  cargo: "\uD83D\uDE9A",
};

const VEHICLE_LABEL: Record<string, string> = {
  bicycle: "Bicycle",
  motorcycle: "Motorcycle",
  cargo: "Cargo",
};

// Rough average speeds for an ETA estimate - same assumption used on the
// client side's fare estimate, kept local since this file only needs it
// for display, not pricing.
const AVERAGE_SPEED_KMH: Record<string, number> = {
  bicycle: 15,
  motorcycle: 30,
  cargo: 20,
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatNaira(kobo: number): string {
  return `\u20A6${Math.round(kobo / 100).toLocaleString()}`;
}

function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)} km`;
}

export default function OnlineSearchPage() {
  const router = useRouter();
  const {
    isOnline,
    location,
    topRequest,
    acceptingId,
    acceptError,
    handleAccept,
    acceptWindowMs,
    geoError,
    permissionState,
  } = useRiderStatus();

  const [secondsLeft, setSecondsLeft] = useState(Math.round(acceptWindowMs / 1000));

  // The route drawn on the map when a request arrives:
  // rider -> pickup -> drop-off, with direction arrows.
  const [routeGeo, setRouteGeo] = useState<RouteGeometry | null>(null);
  const locationRef = useRef(location);
  locationRef.current = location;

  // Restart the visible countdown whenever a new request becomes the top
  // one - purely cosmetic, the actual accept-window timeout and decline
  // logic already live in RiderStatusContext.
  useEffect(() => {
    if (!topRequest) return;
    setSecondsLeft(Math.round(acceptWindowMs / 1000));
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(s - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [topRequest?._id, acceptWindowMs]);

  // Fetch the route once per request (not on every GPS update).
  useEffect(() => {
    setRouteGeo(null);
    if (!topRequest) return;
    const { pickupLat, pickupLng, dropoffLat, dropoffLng } = topRequest;
    if (
      typeof pickupLat !== "number" ||
      typeof pickupLng !== "number" ||
      typeof dropoffLat !== "number" ||
      typeof dropoffLng !== "number"
    ) {
      return;
    }
    let cancelled = false;
    (async () => {
      const pickupPt = { lat: pickupLat, lng: pickupLng };
      const dropoffPt = { lat: dropoffLat, lng: dropoffLng };
      const rider = locationRef.current;
      const [toPickup, trip] = await Promise.all([
        rider ? getRoute(rider, pickupPt) : Promise.resolve(null),
        getRoute(pickupPt, dropoffPt),
      ]);
      if (cancelled) return;
      const coordinates = [
        ...(toPickup?.geometry.coordinates ?? []),
        ...(trip?.geometry.coordinates ?? []),
      ];
      if (coordinates.length > 1) setRouteGeo({ type: "LineString", coordinates });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topRequest?._id]);

  // Offline riders have nothing to do here - send them home.
  useEffect(() => {
    if (!isOnline) router.replace("/dashboard");
  }, [isOnline, router]);

  // Freeze the page behind this screen so it never scrolls.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  if (!isOnline) return null;

  const hasPickupCoords = typeof topRequest?.pickupLat === "number" && typeof topRequest?.pickupLng === "number";
  const hasDropoffCoords = typeof topRequest?.dropoffLat === "number" && typeof topRequest?.dropoffLng === "number";

  const pickupPt = hasPickupCoords
    ? { lat: topRequest!.pickupLat as number, lng: topRequest!.pickupLng as number }
    : null;
  const dropoffPt = hasDropoffCoords
    ? { lat: topRequest!.dropoffLat as number, lng: topRequest!.dropoffLng as number }
    : null;

  const riderToPickupKm =
    location && hasPickupCoords
      ? haversineKm(location, { lat: topRequest!.pickupLat!, lng: topRequest!.pickupLng! })
      : null;

  const routeKm =
    hasPickupCoords && hasDropoffCoords
      ? haversineKm(
          { lat: topRequest!.pickupLat!, lng: topRequest!.pickupLng! },
          { lat: topRequest!.dropoffLat!, lng: topRequest!.dropoffLng! }
        )
      : null;

  const etaMinutes =
    routeKm !== null && topRequest
      ? Math.round((routeKm / (AVERAGE_SPEED_KMH[topRequest.vehicleType] ?? 20)) * 60)
      : null;

  const isHubOrder = !!topRequest?.vendorName;

  // Payment fields live on the request but may not be on the context's type.
  const payInfo = (topRequest ?? {}) as unknown as {
    paymentMethod?: string;
    totalFeeKobo?: number | null;
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col overflow-hidden overscroll-none bg-white"
      style={{ height: "100dvh" }}
    >
      {/* Map takes all the space the bottom sheet does not need */}
      <div className="relative min-h-0 flex-1">
        <MapOrFallback
          courierLocation={location}
          pickup={pickupPt}
          dropoff={dropoffPt}
          route={routeGeo}
          nextStop={pickupPt}
          googleMapsTo={pickupPt}
          googleTravelMode={topRequest?.vehicleType === "bicycle" ? "bicycling" : "driving"}
          className="h-full w-full"
        />

        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 px-4 pb-4"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          {/* Back to the app. The rider stays online and keeps getting requests. */}
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            aria-label="Back to the app"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-brand shadow-lg active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2.5 text-sm font-extrabold text-brand shadow-lg">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Online
          </span>
        </div>

        {topRequest && (
          <div className="pointer-events-none absolute bottom-3 left-4">
            <span className="flex items-center gap-2 rounded-2xl bg-sunshine px-3 py-2 text-xs font-bold text-brand shadow">
              <span className="text-base leading-none">{VEHICLE_ICON[topRequest.vehicleType] ?? ""}</span>
              <span>
                {VEHICLE_LABEL[topRequest.vehicleType] ?? topRequest.vehicleType}
                <span className="block font-medium text-brand/60">Required vehicle</span>
              </span>
            </span>
          </div>
        )}
      </div>

      {(acceptError || (geoError && permissionState !== "denied")) && (
        <p className="shrink-0 bg-red-50 px-4 py-2 text-center text-sm text-red-600">
          {acceptError ?? geoError}
        </p>
      )}

      <div className="shrink-0">
        {!topRequest ? (
          <div
            className="rounded-t-3xl border-t border-slate-200 bg-white px-5 pt-4 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <span className="absolute h-full w-full animate-ping rounded-full bg-brand-accent/20" />
                <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent text-xl text-white">
                  {"\uD83D\uDD0D"}
                </span>
              </div>
              <div className="text-center">
                <p className="text-lg font-extrabold text-brand">Searching for deliveries...</p>
                <p className="mt-1 text-sm text-steel">New requests will appear here automatically</p>
              </div>
            </div>
          </div>
        ) : (
          <div
            key={topRequest._id}
            className="flex max-h-[80dvh] flex-col rounded-t-3xl border-t border-slate-200 bg-white shadow-[0_-12px_32px_rgba(0,0,0,0.16)]"
            style={{ animation: "sheet-slide-up 0.35s ease-out" }}
          >
            {/* Scrollable details - only this part scrolls, never the page */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-2">
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" />

              {/* Category badge */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sunshine px-3 py-1 text-xs font-bold text-brand">
                {isHubOrder ? "\uD83C\uDF54 Food Delivery" : "\uD83D\uDCE6 Delivery"}
              </span>

              {/* Vendor / order header */}
              <div className="mt-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-extrabold text-brand">
                    {topRequest.vendorName || "New delivery request"}
                  </p>
                  {topRequest.orderNumber && (
                    <p className="text-xs font-medium text-steel">Order #{topRequest.orderNumber}</p>
                  )}
                </div>
              </div>

              {/* Earnings + payment method */}
              <div className="mt-3 flex items-center gap-3">
                {typeof topRequest.riderEarningKobo === "number" && (
                  <div className="flex-1 rounded-xl bg-emerald-50 px-4 py-3">
                    <p className="text-xs font-semibold text-emerald-700">Your earnings</p>
                    <p className="text-xl font-extrabold text-emerald-700">
                      {formatNaira(topRequest.riderEarningKobo)}
                    </p>
                  </div>
                )}
                <div className="flex flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 py-3">
                  {isHubOrder ? (
                    <ShieldCheck className="h-5 w-5 shrink-0 text-brand-accent" />
                  ) : (
                    <Banknote className="h-5 w-5 shrink-0 text-brand-accent" />
                  )}
                  <div className="min-w-0">
                    {isHubOrder ? (
                      <>
                        <p className="text-xs font-bold text-brand">In-app payment</p>
                        <p className="text-[11px] text-steel">No cash</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-brand">
                          {payInfo.paymentMethod === "transfer" ? "Bank transfer" : "Cash"}
                        </p>
                        <p className="text-[11px] text-steel">
                          {typeof payInfo.totalFeeKobo === "number"
                            ? `Collect ${formatNaira(payInfo.totalFeeKobo)}`
                            : "Collect from customer"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Route */}
              <div className="mt-4 space-y-3">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                    <div>
                      <p className="text-sm font-bold text-brand">Pickup</p>
                      <p className="text-sm text-slate-600">{topRequest.pickup}</p>
                    </div>
                  </div>
                  {riderToPickupKm !== null && (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {formatKm(riderToPickupKm)} away
                    </span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-accent" />
                    <div>
                      <p className="text-sm font-bold text-brand">Drop-off</p>
                      <p className="text-sm text-slate-600">{topRequest.dropoff}</p>
                    </div>
                  </div>
                  {routeKm !== null && (
                    <span className="shrink-0 rounded-full bg-brand-accent/10 px-2 py-1 text-xs font-semibold text-brand-accent">
                      {formatKm(routeKm)}
                    </span>
                  )}
                </div>
              </div>

              {/* Est time / distance / package stats */}
              <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-xl border border-slate-100 py-3">
                <div className="flex flex-col items-center gap-1 text-center">
                  <Clock className="h-4 w-4 text-steel" />
                  <p className="text-xs text-steel">Est. time</p>
                  <p className="text-sm font-bold text-brand">{etaMinutes !== null ? `${etaMinutes} min` : "\u2014"}</p>
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <MapPin className="h-4 w-4 text-steel" />
                  <p className="text-xs text-steel">Distance</p>
                  <p className="text-sm font-bold text-brand">{routeKm !== null ? formatKm(routeKm) : "\u2014"}</p>
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <Package className="h-4 w-4 text-steel" />
                  <p className="text-xs text-steel">Package</p>
                  <p className="text-sm font-bold text-brand">1</p>
                </div>
              </div>

              {/* Note */}
              {topRequest.note && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-slate-50 px-3.5 py-3">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-steel" />
                  <div>
                    <p className="text-xs font-bold text-brand">Customer note</p>
                    <p className="text-sm text-slate-600">{topRequest.note}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Accept button - always pinned at the bottom of the card */}
            <div
              className="shrink-0 border-t border-slate-100 bg-white px-5 pt-3"
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              <button
                onClick={() => handleAccept(topRequest._id)}
                disabled={acceptingId === topRequest._id}
                className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-sunshine py-4 text-base font-extrabold transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
                style={{ color: "#15181F" }}
              >
                {acceptingId !== topRequest._id && (
                  <span
                    key={topRequest._id}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 bg-white/25"
                    style={{ animation: `accept-water-drain ${acceptWindowMs}ms linear forwards` }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  {acceptingId === topRequest._id ? (
                    "Accepting..."
                  ) : (
                    <>
                      Accept Order <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </span>
              </button>

              {acceptingId !== topRequest._id && (
                <p className="mt-2 text-center text-xs text-steel">Time to accept: {secondsLeft}s</p>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes accept-water-drain {
          from {
            height: 100%;
          }
          to {
            height: 0%;
          }
        }
      `}</style>
    </div>
  );
}