"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// On these screens the phone back button closes the app.
const EXIT_PATHS = ["/", "/login", "/dashboard"];

export default function BackButtonHandler() {
  const pathname = usePathname();
  const router = useRouter();
  const pathRef = useRef(pathname);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    let remove: (() => void) | undefined;

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import("@capacitor/app");

        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          const p = pathRef.current || "/";
          if (EXIT_PATHS.includes(p)) {
            App.exitApp();
            return;
          }
          if (canGoBack) {
            window.history.back();
          } else {
            router.replace("/dashboard");
          }
        });

        if (cancelled) handle.remove();
        else remove = () => handle.remove();
      } catch {
        // not running inside the Android app: do nothing
      }
    })();

    return () => {
      cancelled = true;
      if (remove) remove();
    };
  }, [router]);

  return null;
}