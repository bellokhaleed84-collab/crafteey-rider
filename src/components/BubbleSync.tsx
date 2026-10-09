"use client";

import { useEffect } from "react";
import { useRiderStatus } from "@/contexts/RiderStatusContext";
import { RiderBubble } from "@/lib/riderBubble";

// Tells the Android app whether the rider is online, so the floating bubble
// only runs while online. Does nothing in a normal browser.
export default function BubbleSync() {
  const { isOnline } = useRiderStatus();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform() || cancelled) return;
        await RiderBubble.setOnline({ online: isOnline });
      } catch {
        // old APK without the bubble: do nothing
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  return null;
}