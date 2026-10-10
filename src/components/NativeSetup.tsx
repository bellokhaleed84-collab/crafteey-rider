"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase/clientApp";
import { installBackgroundFetch } from "@/lib/nativeFetch";
import { OverlayPermission } from "@/lib/overlayPermission";
import { RiderBubble } from "@/lib/riderBubble";

const TOKEN_KEY = "crafteey_fcm_token";
const OVERLAY_ASKED_KEY = "crafteey_overlay_asked";
const CHANNEL_ID = "new_requests";

function toHex(n: number): string {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
}

// Turns a CSS colour like "rgb(63, 4, 172)" into hex, or null if it is
// see-through (so we keep looking at the element underneath).
function parseColor(css: string): { color: string; lightBar: boolean } | null {
  const m = css.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+))?/);
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
  if (alpha < 0.5) return null;
  const r = parseInt(m[1], 10);
  const g = parseInt(m[2], 10);
  const b = parseInt(m[3], 10);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return { color: "#" + toHex(r) + toHex(g) + toHex(b), lightBar: luminance > 0.6 };
}

// Finds the colour at the very top edge of the screen: whatever page or
// header is there right now. The Android top bar copies it.
function colorAtTop(): { color: string; lightBar: boolean } {
  const fallback = { color: "#121212", lightBar: false };
  let el: Element | null = document.elementFromPoint(Math.floor(window.innerWidth / 2), 2);
  while (el) {
    const parsed = parseColor(getComputedStyle(el).backgroundColor);
    if (parsed) return parsed;
    el = el.parentElement;
  }
  return fallback;
}

// Runs once inside the Android app: native pings for the background, push
// notifications, the floating bubble helpers, the top bar colour, and a prompt
// for "Display over other apps". Does nothing in a normal browser.
export default function NativeSetup() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, getIdToken } = useAuth();
  const getIdTokenRef = useRef(getIdToken);
  getIdTokenRef.current = getIdToken;
  const [showOverlayPrompt, setShowOverlayPrompt] = useState(false);

  useEffect(() => {
    installBackgroundFetch().catch(() => {});
  }, []);

  // Top bar follows the colour at the top of whatever page is showing.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = "";

    async function apply() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { color, lightBar } = colorAtTop();
        const key = color + (lightBar ? "L" : "D");
        if (key === last) return;
        last = key;
        await RiderBubble.setStatusBar({ color, lightBar });
      } catch {
        // old APK: do nothing
      }
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(apply, 60);
    }

    schedule();
    // Headers and pages can appear a moment late, so also re-check regularly.
    const interval = setInterval(schedule, 700);
    const observer = new MutationObserver(schedule);
    const opts = { attributes: true, attributeFilter: ["class", "style", "data-theme"] };
    observer.observe(document.documentElement, opts);
    observer.observe(document.body, opts);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", schedule);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      observer.disconnect();
      media.removeEventListener("change", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [pathname]);

  // Give the floating bubble the rider's login so it can fetch requests.
  useEffect(() => {
    if (loading) return;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        if (user) {
          await RiderBubble.setSession({
            apiKey: auth.app.options.apiKey ?? "",
            refreshToken: user.refreshToken,
          });
        } else {
          await RiderBubble.setSession({ apiKey: "", refreshToken: "" });
          await RiderBubble.setOnline({ online: false });
        }
      } catch {
        // old APK: do nothing
      }
    })();
  }, [user, loading]);

  // If the rider accepted a job from the bubble, open the active delivery.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function check() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { accepted } = await RiderBubble.consumeAccepted();
        if (accepted && !cancelled) router.push("/dashboard/active");
      } catch {
        // old APK: do nothing
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") check();
    }

    check();
    document.addEventListener("visibilitychange", onVisible);
    document.addEventListener("resume", check);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("resume", check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Ask for "Display over other apps" (only if not already allowed).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        // "Not now" only hides it until the app is opened again.
        if (window.sessionStorage.getItem(OVERLAY_ASKED_KEY) === "1") return;
        const { granted } = await OverlayPermission.canDraw();
        if (!granted && !cancelled) setShowOverlayPrompt(true);
      } catch {
        // old APK without this feature: do nothing
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    async function sendToken(token: string, attempt = 0) {
      try {
        const idToken = await getIdTokenRef.current();
        if (!idToken || cancelled) return;
        const res = await fetch("/api/couriers/push-token", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + idToken },
          body: JSON.stringify({ token }),
        });
        // 404 = the rider profile is not created yet (still registering).
        if (res.status === 404 && attempt < 4) {
          timers.push(setTimeout(() => sendToken(token, attempt + 1), 10000 * (attempt + 1)));
        }
      } catch {
        // will try again next time the app opens
      }
    }

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { PushNotifications } = await import("@capacitor/push-notifications");

        await PushNotifications.createChannel({
          id: CHANNEL_ID,
          name: "New delivery requests",
          description: "Alerts for new delivery requests near you",
          importance: 5,
          visibility: 1,
          vibration: true,
          lights: true,
        }).catch(() => {});

        let status = (await PushNotifications.checkPermissions()).receive;
        if (status !== "granted") status = (await PushNotifications.requestPermissions()).receive;
        if (status !== "granted" || cancelled) return;

        handles.push(
          await PushNotifications.addListener("registration", (t) => {
            try {
              window.localStorage.setItem(TOKEN_KEY, t.value);
            } catch {
              // ignore
            }
            sendToken(t.value);
          })
        );
        handles.push(
          await PushNotifications.addListener("registrationError", (e) => {
            console.error("Push registration failed", e);
          })
        );
        handles.push(
          await PushNotifications.addListener("pushNotificationActionPerformed", () => {
            router.push("/dashboard/online");
          })
        );

        await PushNotifications.register();
      } catch (e) {
        console.error("Push setup failed", e);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      handles.forEach((h) => h.remove().catch(() => {}));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function openOverlaySettings() {
    setShowOverlayPrompt(false);
    try {
      await OverlayPermission.open();
    } catch {
      // ignore
    }
  }

  function skipOverlay() {
    try {
      window.sessionStorage.setItem(OVERLAY_ASKED_KEY, "1");
    } catch {
      // ignore
    }
    setShowOverlayPrompt(false);
  }

  if (!showOverlayPrompt) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9998,
        padding: 16,
        background: "#1c1c1e",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        boxShadow: "0 -8px 30px rgba(0,0,0,0.5)",
        color: "#ffffff",
        fontFamily: "var(--font-inter), sans-serif",
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 600 }}>Allow display over other apps</div>
      <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.4, color: "rgba(255,255,255,0.8)" }}>
        This lets the floating bubble show new delivery requests when you are in another app. On the next screen, switch it on for Crafteey Rider, then come back.
      </div>
      <button
        onClick={openOverlaySettings}
        style={{
          marginTop: 16,
          width: "100%",
          height: 56,
          borderRadius: 14,
          border: "none",
          background: "#FFB400",
          color: "#000000",
          fontSize: 17,
          fontWeight: 600,
        }}
      >
        Open settings
      </button>
      <button
        onClick={skipOverlay}
        style={{
          marginTop: 10,
          width: "100%",
          height: 52,
          borderRadius: 14,
          border: "none",
          background: "transparent",
          color: "rgba(255,255,255,0.7)",
          fontSize: 16,
        }}
      >
        Not now
      </button>
    </div>
  );
}