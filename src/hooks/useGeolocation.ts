"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

export interface LatLng {
  lat: number;
  lng: number;
}

export type GeoPermissionState = "unknown" | "granted" | "denied" | "prompt" | "unsupported";

interface UseGeolocationOptions {
  // Fires on every GPS tick - use to update map markers/UI immediately.
  onUpdate?: (coords: LatLng) => void;
  // Fires at most once per throttleMs - use for anything hitting the network
  // (presence pings, location PATCH calls) so we're not spamming the API.
  onThrottledUpdate?: (coords: LatLng) => void;
  throttleMs?: number;
  enableHighAccuracy?: boolean;
}

// ---------------------------------------------------------------------
// Inside the Android app, tracking runs as a native foreground service so
// it keeps working with the screen locked or the app in the background.
// It is shared: however many components call start(), only one native
// tracker runs, and it stops when the last one stops.
// ---------------------------------------------------------------------
type PosListener = (lat: number, lng: number) => void;
type ErrListener = (code: string | undefined) => void;

const nativePosListeners = new Set<PosListener>();
const nativeErrListeners = new Set<ErrListener>();
let nativeRunning = false;
let nativeQueue: Promise<void> = Promise.resolve();

// Start and stop calls are queued so they can never overlap; each step
// simply moves the tracker to whatever state is wanted at that moment.
function syncNativeTracking() {
  nativeQueue = nativeQueue
    .then(async () => {
      const want = nativePosListeners.size > 0;
      if (want === nativeRunning) return;

      const { BackgroundGeolocation } = await import("@capgo/background-geolocation");

      if (want) {
        await BackgroundGeolocation.start(
          {
            backgroundTitle: "Crafteey Rider",
            backgroundMessage: "You are online and ready for deliveries.",
            requestPermissions: true,
            stale: false,
            distanceFilter: 5,
          },
          (position, error) => {
            if (error) {
              nativeErrListeners.forEach((l) => l(error.code));
              return;
            }
            if (position) {
              nativePosListeners.forEach((l) => l(position.latitude, position.longitude));
            }
          }
        );
        nativeRunning = true;
      } else {
        await BackgroundGeolocation.stop();
        nativeRunning = false;
      }
    })
    .catch(() => {
      nativeErrListeners.forEach((l) => l("START_FAILED"));
    });
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
  const nativeHandlersRef = useRef<{ pos: PosListener; err: ErrListener } | null>(null);
  const lastThrottledRef = useRef<number>(0);
  // Keep the latest callbacks in refs so start()/stop() stay stable across
  // renders - callers don't need to memoize onUpdate/onThrottledUpdate.
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

  const handlePosition = useCallback(
    (lat: number, lng: number) => {
      setPermissionState("granted");
      const coords: LatLng = { lat, lng };
      setLocation(coords);
      onUpdateRef.current?.(coords);

      const now = Date.now();
      if (now - lastThrottledRef.current >= throttleMs) {
        lastThrottledRef.current = now;
        onThrottledUpdateRef.current?.(coords);
      }
    },
    [throttleMs]
  );

  const stop = useCallback(() => {
    const native = nativeHandlersRef.current;
    if (native) {
      nativePosListeners.delete(native.pos);
      nativeErrListeners.delete(native.err);
      nativeHandlersRef.current = null;
      syncNativeTracking();
    }
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatching(false);
  }, []);

  const start = useCallback(() => {
    // Android app: native background tracking.
    if (Capacitor.isNativePlatform()) {
      if (nativeHandlersRef.current) return; // already tracking
      setError(null);

      const pos: PosListener = (lat, lng) => handlePosition(lat, lng);
      const err: ErrListener = (code) => {
        if (code === "NOT_AUTHORIZED") {
          setPermissionState("denied");
          setError("Location access was denied. Enable it in your device settings to go online.");
        } else {
          setError("Couldn't get your location. Check your GPS and try again.");
        }
      };

      nativeHandlersRef.current = { pos, err };
      nativePosListeners.add(pos);
      nativeErrListeners.add(err);
      syncNativeTracking();
      setWatching(true);
      return;
    }

    // Browser: normal watchPosition.
    if (!("geolocation" in navigator)) {
      setPermissionState("unsupported");
      setError("Location isn't supported on this device.");
      return;
    }
    if (watchIdRef.current !== null) return; // already watching

    setError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => handlePosition(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState("denied");
          setError("Location access was denied. Enable it in your device settings to go online.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Couldn't determine your location. Check your GPS or network connection.");
        } else if (err.code === err.TIMEOUT) {
          setError("Location request timed out. Retrying\u2026");
        } else {
          setError("Couldn't get your location.");
        }
      },
      { enableHighAccuracy, maximumAge: 5000, timeout: 15000 }
    );
    setWatching(true);
  }, [enableHighAccuracy, handlePosition]);

  // Opens the phone's location settings (Android app only).
  const openSettings = useCallback(async () => {
    try {
      const { BackgroundGeolocation } = await import("@capgo/background-geolocation");
      await BackgroundGeolocation.openSettings();
    } catch {
      // not in the Android app
    }
  }, []);

  // Always clear the watch on unmount, regardless of which page used it.
  useEffect(() => stop, [stop]);

  return { location, permissionState, error, watching, start, stop, openSettings };
}