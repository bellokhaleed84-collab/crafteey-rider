"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, MessageCircle, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import RouteMap from "@/components/map/RouteMap";
import SlideButton from "@/components/SlideButton";
import ChatSheet, { useChatUnread } from "@/components/chat/ChatSheet";
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
import { getGoogleMapsDirectionsUrl } from "@/lib/navigation";
import { formatNaira } from "@/lib/format";

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
  // Older requests won't have these, so every read falls back to clientName/clientPhone.
  pickupContactName?: string;
  pickupContactPhone?: string;
  receiverName?: string;
  receiverPhone?: string;
  // Payment (direct rides only)
  source?: string;
  totalFeeKobo?: number | null;
  riderEarningKobo?: number | null;
  platformCommissionKobo?: number | null;
  paymentMethod?: "cash" | "transfer";
  paymentStatus?: string;
}

// How often we re-hit the Directions API on a timer while the destination
// hasn't changed and the rider hasn't strayed off-route.
const ROUTE_REFRESH_MS = 20000;
// If the rider's live position is more than this far from the last known
// route line, recalculate immediately.
const DEVIATION_THRESHOLD_METERS = 60;
// Close enough to a pickup/dropoff point to consider the rider "arrived".
const ARRIVAL_THRESHOLD_METERS = 60;

// --- Bottom sheet sizing ---
const SHEET_PEEK_PX = 148;
const SHEET_EXPANDED_RATIO = 0.82;
const TAP_THRESHOLD_PX = 6;

const SLIDE_LABEL: Record<string, string> = {
  [COURIER_STATUS.ACCEPTED]: "Slide to confirm pickup",
  [COURIER_STATUS.PICKED_UP]: "Slide to start delivery",
  [COURIER_STATUS.EN_ROUTE]: "Slide to finish delivery",
};

type View = "card" | "payment" | "collected";

function stopDrag(e: ReactPointerEvent<HTMLElement>) {
  e.stopPropagation();
}

export default function ActiveDeliveryPage() {
  const router = useRouter();
  const { getIdToken } = useAuth();
  const [request, setRequest] = useState<ActiveRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("card");
  const [chatOpen, setChatOpen] = useState(false);

  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<LatLng | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  // Live route: courier's current position to whichever point is the
  // active destination for the current stage.
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const routeRef = useRef<RouteResult | null>(null);
  const lastRouteFetchRef = useRef(0);
  const lastRouteDestKeyRef = useRef<string | null>(null);

  // Static route: pickup to dropoff, fetched once per pickup/dropoff pair.
  const [pickupToDropoffRoute, setPickupToDropoffRoute] = useState<RouteResult | null>(null);

  const [arrivalConfirmed, setArrivalConfirmed] = useState(false);

  // --- Bottom sheet state ---
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [viewportH, setViewportH] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 800
  );
  const dragRef = useRef<{ pointerId: number; startY: number } | null>(null);
  const [liveTranslate, setLiveTranslate] = useState<number | null>(null);

  useEffect(() => {
    function update() {
      setViewportH(window.innerHeight);
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const sheetHeightPx = Math.round(viewportH * SHEET_EXPANDED_RATIO);
  const collapsedTranslate = Math.max(sheetHeightPx - SHEET_PEEK_PX, 0);
  const restTranslate = sheetExpanded ? 0 : collapsedTranslate;
  const sheetTranslate = liveTranslate ?? restTranslate;

  function handleSheetPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startY: e.clientY };
    setLiveTranslate(restTranslate);
  }

  function handleSheetPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const delta = e.clientY - dragRef.current.startY;
    const next = Math.min(Math.max(restTranslate + delta, 0), collapsedTranslate);
    setLiveTranslate(next);
  }

  function handleSheetPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const dragDistance = Math.abs(e.clientY - dragRef.current.startY);
    const current = liveTranslate ?? restTranslate;
    dragRef.current = null;
    setLiveTranslate(null);

    if (dragDistance < TAP_THRESHOLD_PX) {
      setSheetExpanded((v) => !v);
    } else {
      setSheetExpanded(current < collapsedTranslate / 2);
    }
  }

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

  // Unread dot for the chat buttons.
  const unread = useChatUnread(requestId, "courier", getIdToken, !!requestId, chatOpen);

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

  // Resolve drop-off coordinates immediately too, so the pickup-to-drop-off
  // distance can be shown as a preview while heading to pickup.
  useEffect(() => {
    if (!request) return;
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
  }, [request?.dropoff, request?.dropoffLat, request?.dropoffLng]);

  // Fetch the static pickup to dropoff leg once both ends are known.
  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) return;
    let cancelled = false;
    getRoute(pickupCoords, dropoffCoords).then((result) => {
      if (!cancelled && result) setPickupToDropoffRoute(result);
    });
    return () => {
      cancelled = true;
    };
  }, [pickupCoords?.lat, pickupCoords?.lng, dropoffCoords?.lat, dropoffCoords?.lng]);

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

  // Recalculate the live route on a timer, immediately when the
  // destination changes, or immediately on deviation.
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
        lastRouteFetchRef.current = 0;
        lastRouteDestKeyRef.current = null;
        setArrivalConfirmed(false);
        setSheetExpanded(false);
        setView("card");
      }
    } catch (err: any) {
      setError(err.message || "Couldn't update status.");
    } finally {
      setAdvancing(false);
    }
  }

  async function handleCollectPayment() {
    if (!request) return;
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/courier-requests/${request._id}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "collect" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't confirm the payment.");
        return;
      }
      setRequest((r) => (r ? { ...r, paymentStatus: "collected" } : r));
      setView("collected");
    } catch (err: any) {
      setError(err.message || "Couldn't confirm the payment.");
    }
  }

  if (loading || !request || !stage) {
    return <p className="p-4 text-sm text-steel">Loading...</p>;
  }

  const displayError = geo.error ?? geocodeError ?? error;

  // --- Two-leg distance display ---
  const toPickupDistance = stage.destination === "pickup" ? route?.distanceMeters ?? null : null;
  const toPickupDone = stage.destination !== "pickup";

  const pickupToDropoffDistance =
    stage.destination === "dropoff"
      ? route?.distanceMeters ?? pickupToDropoffRoute?.distanceMeters ?? null
      : pickupToDropoffRoute?.distanceMeters ?? null;

  // --- Contact card: pickup contact while heading to pickup, receiver
  // once heading to drop-off.
  const contactLabel = stage.destination === "dropoff" ? "Receiver" : "Pickup contact";
  const contactName =
    stage.destination === "dropoff"
      ? request.receiverName || request.clientName
      : request.pickupContactName || request.clientName;
  const contactPhone =
    stage.destination === "dropoff"
      ? request.receiverPhone || request.clientPhone
      : request.pickupContactPhone || request.clientPhone;

  // --- Payment ---
  const needsPayment =
    request.source !== "hub" &&
    typeof request.totalFeeKobo === "number" &&
    request.totalFeeKobo > 0;
  const totalFeeKobo = needsPayment ? (request.totalFeeKobo as number) : 0;
  const paymentDone = request.paymentStatus === "collected";
  const isTransfer = request.paymentMethod === "transfer";
  const atPaymentStep =
    needsPayment && request.status === COURIER_STATUS.EN_ROUTE && !paymentDone;

  return (
    <>
      <div className="fixed inset-0 z-0 overflow-hidden bg-slate-100">
        <RouteMap
          pickup={showDropoff ? null : pickupCoords}
          dropoff={showDropoff ? dropoffCoords : null}
          courierLocation={geo.location}
          route={route?.geometry}
          followCourier
          recenterBottom={SHEET_PEEK_PX + 16}
          className="h-full w-full"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-3">
          {route ? (
            <div className="pointer-events-auto rounded-xl bg-white/95 px-3 py-2 shadow">
              <p className="text-sm font-bold text-brand">{formatDuration(route.durationSeconds)}</p>
              <p className="text-xs text-steel">{formatDistance(route.distanceMeters)}</p>
            </div>
          ) : (
            <span />
          )}
          {recalculating && (
            <div className="pointer-events-auto rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow">
              Recalculating route...
            </div>
          )}
        </div>

        {hasArrived && !sheetExpanded && (
          <div className="pointer-events-none absolute inset-x-3 top-16 z-10 rounded-lg bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-lg">
            {"\uD83D\uDCCD"} {stage.arrivedLabel}
          </div>
        )}

        {destination && !sheetExpanded && (
          <a
            href={getGoogleMapsDirectionsUrl(destination.lat, destination.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent text-white shadow-lg transition-transform duration-150 active:scale-95"
            style={{ bottom: SHEET_PEEK_PX + 16 }}
            aria-label="Open turn-by-turn navigation"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M12 2L4.5 20.29a.5.5 0 00.72.63L12 17l6.78 3.92a.5.5 0 00.72-.63L12 2z" />
            </svg>
          </a>
        )}

        {sheetExpanded && (
          <div
            className="absolute inset-0 z-10 bg-black/20"
            onClick={() => setSheetExpanded(false)}
          />
        )}

        <div
          className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-3xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.12)]"
          style={{
            height: sheetHeightPx,
            transform: `translateY(${sheetTranslate}px)`,
            transition: liveTranslate === null ? "transform 220ms ease" : "none",
          }}
        >
          {/* Peek header: status, distance, quick chat + call */}
          <div
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerUp}
            onPointerCancel={handleSheetPointerUp}
            className="flex shrink-0 cursor-grab touch-none flex-col px-5 pb-3 pt-2.5 active:cursor-grabbing"
          >
            <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-300" />
            <div className="mt-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <span className="inline-block rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {stage.statusLabel}
                </span>
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-sm leading-tight">
                    {toPickupDone ? (
                      <span className="font-semibold text-emerald-600">{"\u2713"} Picked up</span>
                    ) : (
                      <>
                        <span className="font-bold text-brand">
                          {toPickupDistance != null ? formatDistance(toPickupDistance) : "\u2014"}
                        </span>{" "}
                        <span className="text-xs font-medium text-steel">to pickup</span>
                      </>
                    )}
                  </p>
                  <p className="text-sm leading-tight">
                    <span
                      className={
                        stage.destination === "dropoff" ? "font-bold text-brand" : "font-semibold text-steel"
                      }
                    >
                      {pickupToDropoffDistance != null ? formatDistance(pickupToDropoffDistance) : "\u2014"}
                    </span>{" "}
                    <span className="text-xs font-medium text-steel">{"pickup \u2192 drop-off"}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onPointerDown={stopDrag}
                onClick={() => setChatOpen(true)}
                aria-label="Chat with the customer"
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"
              >
                <MessageCircle className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              <a
                href={`tel:${contactPhone}`}
                onPointerDown={stopDrag}
                aria-label={`Call ${contactName}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-accent text-white"
              >
                <Phone className="h-5 w-5" />
              </a>
              <svg
                className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${sheetExpanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6">
            {geo.permissionState === "denied" && (
              <p className="mb-3 text-xs text-red-600">
                Location sharing is off - the client won't see your live position until you enable
                location access.
              </p>
            )}

            {/* Timeline */}
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="my-1 h-10 w-px bg-slate-200" />
                <span className="h-3 w-3 rounded-full bg-brand-accent" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-400">Pickup</p>
                  <p className="text-sm font-semibold text-brand">{request.pickup}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400">Drop-off</p>
                  <p className="text-sm font-semibold text-brand">{request.dropoff}</p>
                </div>
              </div>
            </div>

            {request.note && (
              <>
                <p className="mt-3 text-xs font-semibold text-slate-400">Note</p>
                <p className="text-sm text-steel">{request.note}</p>
              </>
            )}

            {/* Payment chip (direct rides) */}
            {needsPayment && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-slate-400">Payment</p>
                  <p className="text-sm font-bold text-brand">
                    {isTransfer ? "Bank transfer" : "Cash"}
                    {paymentDone ? " \u2022 Collected" : ""}
                  </p>
                </div>
                <p className="text-base font-extrabold text-brand">{formatNaira(totalFeeKobo)}</p>
              </div>
            )}

            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-400">{contactLabel}</p>
              <p className="text-sm font-semibold text-brand">{contactName}</p>
              <div className="mt-3 flex gap-2">
                <a
                  href={`tel:${contactPhone}`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-accent py-2.5 text-center text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.98]"
                >
                  <Phone className="h-4 w-4" /> Call
                </a>
                <button
                  type="button"
                  onClick={() => setChatOpen(true)}
                  className="relative flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-700 transition-transform duration-150 active:scale-[0.98]"
                >
                  <MessageCircle className="h-4 w-4" /> Chat
                  {unread > 0 && (
                    <span className="absolute right-3 top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Chat goes to {request.clientName}, who booked this delivery.
              </p>
            </div>

            {displayError && geo.permissionState !== "denied" && (
              <p className="mt-3 text-sm text-red-600">{displayError}</p>
            )}

            {/* Main action */}
            {hasArrived && !arrivalConfirmed ? (
              <button
                onClick={() => setArrivalConfirmed(true)}
                className="mt-5 w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.98]"
                style={{ animation: "arrival-pulse 2s ease-in-out infinite" }}
              >
                Confirm arrival
              </button>
            ) : atPaymentStep ? (
              <button
                onClick={() => setView("payment")}
                className="mt-5 w-full rounded-xl bg-brand-accent py-3.5 text-sm font-bold text-white transition-transform duration-150 active:scale-[0.98]"
              >
                Collect payment {"\u2022"} {formatNaira(totalFeeKobo)}
              </button>
            ) : (
              <div className="mt-5">
                <SlideButton
                  key={request.status}
                  label={SLIDE_LABEL[request.status] ?? stage.nextActionLabel}
                  onComplete={handleAdvance}
                  disabled={advancing}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ----------- Payment page ----------- */}
      {needsPayment && view !== "card" && (
        <div className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-concrete">
          {view === "collected" ? (
            <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 text-center">
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-sunshine">
                <Check className="h-12 w-12" strokeWidth={3} style={{ color: "#15181F" }} />
              </span>
              <h1 className="mt-6 text-2xl font-extrabold text-brand">Payment collected!</h1>
              <p className="mt-1 text-sm text-steel">You've collected</p>
              <p className="mt-1 text-3xl font-extrabold text-brand">{formatNaira(totalFeeKobo)}</p>
              <button
                onClick={() => setView("card")}
                className="mt-8 w-full rounded-xl bg-sunshine py-3.5 text-sm font-extrabold"
                style={{ color: "#15181F" }}
              >
                Back to delivery
              </button>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-lg px-5 pb-8 pt-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setView("card")}
                  aria-label="Back to delivery"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow"
                >
                  <ArrowLeft className="h-5 w-5" style={{ color: "#15181F" }} />
                </button>
                <h1 className="text-lg font-bold text-brand">Payment</h1>
              </div>

              <div className="mt-5 rounded-2xl bg-white p-5 shadow-md">
                <p className="text-xs font-semibold text-steel">Total to collect</p>
                <p className="mt-1 text-4xl font-extrabold text-brand">{formatNaira(totalFeeKobo)}</p>
                <span className="mt-3 inline-block rounded-full bg-sunshine px-3 py-1 text-xs font-bold" style={{ color: "#15181F" }}>
                  {isTransfer ? "Bank transfer" : "Cash"}
                </span>
              </div>

              <div className="mt-4 space-y-3 rounded-2xl bg-white p-5 shadow-md">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-steel">Delivery fee</span>
                  <span className="font-bold text-brand">{formatNaira(totalFeeKobo)}</span>
                </div>
                {typeof request.riderEarningKobo === "number" && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-steel">Your earnings</span>
                    <span className="font-bold text-brand">{formatNaira(request.riderEarningKobo)}</span>
                  </div>
                )}
                {typeof request.platformCommissionKobo === "number" && (
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-steel">Crafteey fee</span>
                      <span className="font-bold text-brand">{formatNaira(request.platformCommissionKobo)}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Added to your balance owed after the delivery.
                    </p>
                  </div>
                )}
              </div>

              {isTransfer ? (
                request.paymentStatus === "client_marked_paid" ? (
                  <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    The customer says they've paid. Check your bank app to confirm the money has
                    arrived, then slide below.
                  </p>
                ) : (
                  <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-steel shadow-md">
                    Waiting for the customer to transfer to your account. Check your bank app before
                    you confirm.
                  </p>
                )
              ) : (
                <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-steel shadow-md">
                  Collect the cash from the receiver, then slide below.
                </p>
              )}

              {displayError && <p className="mt-3 text-sm text-red-600">{displayError}</p>}

              <div className="mt-6">
                <SlideButton
                  label="Slide when you've been paid"
                  tone="green"
                  onComplete={handleCollectPayment}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {chatOpen && (
        <ChatSheet
          requestId={request._id}
          role="courier"
          title={request.clientName}
          subtitle="Customer chat"
          getIdToken={getIdToken}
          onClose={() => setChatOpen(false)}
        />
      )}
    </>
  );
}