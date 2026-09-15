"use client";

import { useEffect, useState } from "react";
import RouteMap, { type LatLng } from "@/components/map/RouteMap";
import { getPreferGoogleMaps, getGoogleMapsDirectionsUrl } from "@/lib/navigation";

interface MapOrFallbackProps {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  courierLocation?: LatLng | null;
  className?: string;
}

export default function MapOrFallback({
  pickup,
  dropoff,
  courierLocation,
  className,
}: MapOrFallbackProps) {
  const [preferGoogle, setPreferGoogleState] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    setPreferGoogleState(getPreferGoogleMaps());
  }, []);

  const destination = dropoff ?? pickup ?? courierLocation ?? null;
  const showFallback = preferGoogle || mapFailed;

  if (showFallback) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-center ${
          className ?? "h-56 w-full"
        }`}
      >
        <p className="text-sm text-steel">
          {mapFailed && !preferGoogle
            ? "The in-app map couldn't load."
            : "Using Google Maps for navigation."}
        </p>
        {destination ? (
          <a
            href={getGoogleMapsDirectionsUrl(destination.lat, destination.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 rounded-xl bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
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
      className={className}
      onError={() => setMapFailed(true)}
    />
  );
}