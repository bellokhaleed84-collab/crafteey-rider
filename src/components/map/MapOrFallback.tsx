"use client";

import { useState } from "react";
import RouteMap, { type LatLng } from "@/components/map/RouteMap";
import type { RouteGeometry } from "@/lib/directions";
import { getGoogleMapsDirectionsUrl, type GoogleTravelMode } from "@/lib/navigation";

interface MapOrFallbackProps {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  courierLocation?: LatLng | null;
  route?: RouteGeometry | null;
  // The stop the rider heads to first (gets the pulsing ring).
  nextStop?: LatLng | null;
  // Where the round Google Maps button sends the rider.
  googleMapsTo?: LatLng | null;
  googleTravelMode?: GoogleTravelMode;
  className?: string;
}

export default function MapOrFallback({
  pickup,
  dropoff,
  courierLocation,
  route,
  nextStop,
  googleMapsTo,
  googleTravelMode,
  className,
}: MapOrFallbackProps) {
  const [mapFailed, setMapFailed] = useState(false);

  const destination = googleMapsTo ?? nextStop ?? dropoff ?? pickup ?? courierLocation ?? null;

  if (mapFailed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-center ${
          className ?? "h-56 w-full"
        }`}
      >
        <p className="text-sm text-steel">The in-app map couldn&apos;t load.</p>
        {destination ? (
          <a
            href={getGoogleMapsDirectionsUrl(destination.lat, destination.lng, googleTravelMode)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 rounded-xl bg-brand-accent px-4 py-3 text-sm font-semibold text-white"
          >
            Open in Google Maps
          </a>
        ) : (
          <p className="text-xs text-slate-400">No location available yet.</p>
        )}
      </div>
    );
  }

  return (
    <RouteMap
      pickup={pickup}
      dropoff={dropoff}
      courierLocation={courierLocation}
      route={route}
      nextStop={nextStop}
      googleMapsTo={googleMapsTo}
      googleTravelMode={googleTravelMode}
      className={className}
      onError={() => setMapFailed(true)}
    />
  );
}