"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface LatLng {
  lat: number;
  lng: number;
}

export type GeoPermissionState = "unknown" | "granted" | "denied" | "prompt" | "unsupported";

interface UseGeolocationOptions {
  // Fires on every GPS tick — use to update map markers/UI immediately.
  onUpdate?: (coords: LatLng) => void;
  // Fires at most once per throttleMs — use for anything hitting the network
  // (presence pings, location PATCH calls) so we're not spamming the API.
  onThrottledUpdate?: (coords: LatLng) => void;
  throttleMs?: number;
  enableHighAccuracy?: boolean;
}

// Consolidates the watchPosition + permission + throttling logic that was
// previously duplicated between dashboard/page.tsx and
// dashboard/active/page.tsx. Both should now use this instead of calling
// navigator.geolocation directly.
export function useGeolocation({
  onUpdate,
  onThrottledUpdate,
  throttleMs = 8000,
  enableHighAccuracy = true,
}: UseGeolocationOptions = {}) {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [permissionState, setPermissionState] = useState<GeoPermissionState>("unknown");
  const [error, setError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastThrottledRef = useRef<number>(0);
  // Keep the latest callbacks in refs so start()/stop() stay stable across
  // renders — callers don't need to memoize onUpdate/onThrottledUpdate.
  const onUpdateRef = useRef(onUpdate);
  const onThrottledUpdateRef = useRef(onThrottledUpdate);
  onUpdateRef.current = onUpdate;
  onThrottledUpdateRef.current = onThrottledUpdate;

  // Check permission state up front where the browser supports the
  // Permissions API, so the UI can show "location access needed" proactively
  // instead of only reacting after watchPosition fails.
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setPermissionState("unsupported");
      return;
    }
    if (!("permissions" in navigator) || !navigator.permissions?.query) {
      setPermissionState("prompt");
      return;
    }
    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (cancelled) return;
        setPermissionState(status.state as GeoPermissionState);
        status.onchange = () => {
          if (!cancelled) setPermissionState(status.state as GeoPermissionState);
        };
      })
      .catch(() => {
        if (!cancelled) setPermissionState("prompt");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatching(false);
  }, []);

  const start = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setPermissionState("unsupported");
      setError("Location isn't supported on this device.");
      return;
    }
    if (watchIdRef.current !== null) return; // already watching

    setError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPermissionState("granted");
        const coords: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(coords);
        onUpdateRef.current?.(coords);

        const now = Date.now();
        if (now - lastThrottledRef.current >= throttleMs) {
          lastThrottledRef.current = now;
          onThrottledUpdateRef.current?.(coords);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState("denied");
          setError("Location access was denied. Enable it in your device settings to go online.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Couldn't determine your location. Check your GPS or network connection.");
        } else if (err.code === err.TIMEOUT) {
          setError("Location request timed out. Retrying…");
        } else {
          setError("Couldn't get your location.");
        }
      },
      { enableHighAccuracy, maximumAge: 5000, timeout: 15000 }
    );
    setWatching(true);
  }, [enableHighAccuracy, throttleMs]);

  // Always clear the watch on unmount, regardless of which page used it.
  useEffect(() => stop, [stop]);

  return { location, permissionState, error, watching, start, stop };
}