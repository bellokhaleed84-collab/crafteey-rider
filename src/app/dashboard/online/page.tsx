"use client";

import { useRouter } from "next/navigation";
import MapOrFallback from "@/components/map/MapOrFallback";
import { useRiderStatus } from "@/contexts/RiderStatusContext";

// Full-screen search view — entered by tapping the map box on Home.
// Location sharing and queue polling keep running from RiderStatusContext
// regardless of whether this screen or Home is mounted, so the back arrow
// here just navigates, it doesn't go offline or stop anything.
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

  // If the rider goes offline while this screen is open, there's nothing
  // to search for — send them back to Home rather than showing a dead
  // full-screen map with no way to act on it.
  if (!isOnline) {
    router.replace("/dashboard");
    return null;
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <div className="relative flex-1">
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
            className="relative mt-4 w-full overflow-hidden rounded-xl bg-brand-accent py-3 text-sm font-bold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
          >
            {/* Water-fill drain: starts full, empties over the accept
                window. Remounts (via key={topRequest._id}) each time a
                new request takes the top slot, so it always restarts
                from full. Purely visual — no numeric countdown. */}
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