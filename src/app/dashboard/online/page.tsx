"use client";

import { useRouter } from "next/navigation";
import MapOrFallback from "@/components/map/MapOrFallback";
import { useRiderStatus } from "@/contexts/RiderStatusContext";

const VEHICLE_ICON: Record<string, string> = {
  bicycle: "🚲",
  motorcycle: "🏍️",
  cargo: "🚚",
};

function formatNaira(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString()}`;
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

  if (!isOnline) {
    router.replace("/dashboard");
    return null;
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* Map now takes less vertical space so the sheet sits higher and reads as the focus */}
      <div className="relative h-[38vh] shrink-0">
        <MapOrFallback courierLocation={location} className="h-full w-full" />

        <div className="absolute inset-x-0 top-0 flex items-center gap-3 p-4">
          <button
            onClick={() => router.push("/dashboard")}
            aria-label="Back to home"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-brand shadow"
          >
            ←
          </button>
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-brand shadow">
            🟢 Online
          </span>
        </div>
      </div>

      {(acceptError || (geoError && permissionState !== "denied")) && (
        <p className="bg-red-50 px-4 py-2 text-center text-sm text-red-600">
          {acceptError ?? geoError}
        </p>
      )}

      <div className="flex flex-1 flex-col justify-end">
        {!topRequest ? (
          <div className="rounded-t-3xl border-t border-slate-200 bg-white px-5 pb-8 pt-6 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
            <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <span className="absolute h-full w-full animate-ping rounded-full bg-brand-accent/20" />
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand-accent text-white">
                  🔍
                </span>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-brand">Searching for deliveries…</p>
                <p className="mt-1 text-sm text-steel">New requests will appear here automatically</p>
              </div>
            </div>
          </div>
        ) : (
          <div
            key={topRequest._id}
            className="rounded-t-3xl border-t border-slate-200 bg-white p-5 shadow-[0_-12px_32px_rgba(0,0,0,0.16)]"
            style={{ animation: "sheet-slide-up 0.35s ease-out" }}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" />

            {/* Header: order # / vendor + vehicle badge */}
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-400">
                  {topRequest.orderNumber ? `Order ${topRequest.orderNumber}` : "New delivery request"}
                </p>
                {topRequest.vendorName && (
                  <p className="truncate text-sm font-bold text-brand">{topRequest.vendorName}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                {VEHICLE_ICON[topRequest.vehicleType] ?? ""} {topRequest.vehicleType}
              </span>
            </div>

            {/* Price — the number the rider actually cares about, front and center */}
            {typeof topRequest.riderEarningKobo === "number" && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                <span className="text-xs font-semibold text-emerald-700">You'll earn</span>
                <span className="text-lg font-extrabold text-emerald-700">
                  {formatNaira(topRequest.riderEarningKobo)}
                </span>
              </div>
            )}

            {/* Route — pickup/dropoff with a connecting line, like the client-side RouteSummary */}
            <div className="mt-4 flex items-start gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="my-1 h-8 w-px bg-slate-200" />
                <span className="h-3 w-3 rounded-full bg-brand-accent" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pickup</p>
                  <p className="text-sm font-semibold text-brand">{topRequest.pickup}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Drop-off</p>
                  <p className="text-sm font-semibold text-brand">{topRequest.dropoff}</p>
                </div>
              </div>
            </div>

            {topRequest.note && (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-steel">{topRequest.note}</p>
            )}

            <button
              onClick={() => handleAccept(topRequest._id)}
              disabled={acceptingId === topRequest._id}
              className="relative mt-4 w-full overflow-hidden rounded-xl bg-brand-accent py-3 text-sm font-bold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
            >
              {acceptingId !== topRequest._id && (
                <span
                  key={topRequest._id}
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 bg-white/25"
                  style={{ animation: `accept-water-drain ${acceptWindowMs}ms linear forwards` }}
                />
              )}
              <span className="relative">
                {acceptingId === topRequest._id ? "Accepting…" : "Accept delivery"}
              </span>
            </button>
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