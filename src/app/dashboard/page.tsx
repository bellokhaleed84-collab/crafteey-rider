"use client";

import { useRouter } from "next/navigation";
import MapOrFallback from "@/components/map/MapOrFallback";
import { useRiderStatus } from "@/contexts/RiderStatusContext";

// This is now the permanent base screen — the online/offline toggle lives
// here and stays here, so going online no longer replaces this page with
// a different view. Tapping the map box while online is what opens the
// full-screen search view at /dashboard/online.
export default function DashboardHomePage() {
  const router = useRouter();
  const { isOnline, togglingOnline, toggleOnline, location, permissionState, geoError } =
    useRiderStatus();

  function handleMapTap() {
    if (!isOnline) return;
    router.push("/dashboard/online");
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-lg font-bold text-brand">
          {isOnline ? "You're online" : "You're offline"}
        </h1>
        <p className="text-sm text-steel">
          {isOnline ? "Tap the map to search for deliveries" : "Ready to go?"}
        </p>
      </div>

      <button
        type="button"
        onClick={handleMapTap}
        disabled={!isOnline}
        aria-label={isOnline ? "Open the live map to search for deliveries" : "Map preview"}
        className={`block w-full overflow-hidden rounded-2xl border border-slate-200 text-left transition-transform duration-150 ${
          isOnline ? "active:scale-[0.99]" : "cursor-default"
        }`}
      >
        <MapOrFallback courierLocation={location} className="h-56 w-full" />
      </button>

      <button
        onClick={toggleOnline}
        disabled={togglingOnline}
        className={`w-full rounded-xl py-3 text-sm font-bold text-white transition-transform duration-150 active:scale-95 disabled:opacity-60 disabled:[animation:none] ${
          isOnline ? "bg-slate-700" : "bg-brand-accent"
        }`}
        style={{
          animation:
            !isOnline && !togglingOnline ? "go-online-pulse 2.2s ease-in-out infinite" : "none",
        }}
      >
        {togglingOnline ? "Please wait…" : isOnline ? "Go offline" : "Go online"}
      </button>

      {permissionState === "denied" && (
        <p className="text-sm text-red-600">
          Location access is turned off for this app. Enable it in your
          browser/device settings, then try going online again.
        </p>
      )}
      {geoError && permissionState !== "denied" && (
        <p className="text-sm text-red-600">{geoError}</p>
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