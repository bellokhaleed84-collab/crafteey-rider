"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation, type LatLng, type GeoPermissionState } from "@/hooks/useGeolocation";

export interface QueueRequest {
  _id: string;
  pickup: string;
  dropoff: string;
  note: string;
  createdAt: string;
}

// How long a request stays visible before it's auto-hidden from view.
const ACCEPT_WINDOW_MS = 8000;
// How long a timed-out request stays hidden before it's eligible to
// resurface (there's no decline endpoint yet, so this is purely a
// client-side "don't stare at the same expired card" cooldown — it can
// still come back if nothing else is in the queue).
const HIDE_AFTER_TIMEOUT_MS = 20000;

interface RiderStatusContextType {
  isOnline: boolean;
  togglingOnline: boolean;
  toggleOnline: () => Promise<void>;
  location: LatLng | null;
  permissionState: GeoPermissionState;
  geoError: string | null;
  requests: QueueRequest[];
  topRequest: QueueRequest | null;
  acceptingId: string | null;
  acceptError: string | null;
  handleAccept: (id: string) => Promise<void>;
  acceptWindowMs: number;
}

const RiderStatusContext = createContext<RiderStatusContextType | undefined>(undefined);

// Lives at the dashboard layout level — not inside a single page — so
// going online, live location sharing, and the delivery-request queue all
// keep running in the background no matter which screen under /dashboard
// the rider is currently looking at. Previously this all lived inside
// dashboard/page.tsx, which meant navigating away silently dropped it.
export function RiderStatusProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { getIdToken } = useAuth();

  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);

  const [requests, setRequests] = useState<QueueRequest[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const hiddenUntilRef = useRef<Record<string, number>>({});
  const [hiddenTick, setHiddenTick] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function sendPresence(next: boolean, coords?: LatLng | null) {
    const token = await getIdToken();
    if (!token) return;
    await fetch("/api/couriers/online", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isOnline: next, location: coords ?? null }),
    }).catch(() => {});
  }

  const geo = useGeolocation({
    onThrottledUpdate: (coords) => sendPresence(true, coords),
  });

  // Restore online state on mount/refresh so a page reload doesn't
  // silently flip the rider offline in the UI while the DB still thinks
  // they're online.
  useEffect(() => {
    (async () => {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch("/api/couriers/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.courier?.isOnline) {
          setIsOnline(true);
          geo.start();
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkActiveThenLoadQueue = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;

    // If this courier already has an active delivery, send them there —
    // they can't accept a second job.
    const activeRes = await fetch("/api/courier-requests/active", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const activeData = await activeRes.json().catch(() => ({}));
    if (activeData.request) {
      // Rider has a job in progress — the queue is irrelevant until it's
      // done. Clear it (and any pending hide/reveal timers) so a stale
      // request from before acceptance can't keep cycling through the
      // ring UI for the entire duration of the delivery. Previously this
      // branch returned without touching `requests` at all, so the array
      // stayed frozen on the just-accepted request and the accept-window
      // hide/reveal timers kept re-surfacing it every ~28s — that was the
      // "same ride keeps ringing again and again" bug.
      setRequests([]);
      hiddenUntilRef.current = {};
      router.replace("/dashboard/active");
      return;
    }

    const queueRes = await fetch("/api/courier-requests/queue", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (queueRes.ok) {
      const data = await queueRes.json();
      setRequests(data.requests ?? []);
    }
  }, [getIdToken, router]);

  // Only poll the queue while online — keeps running regardless of which
  // /dashboard screen is currently mounted.
  useEffect(() => {
    if (!isOnline) {
      setRequests([]);
      return;
    }
    checkActiveThenLoadQueue();
    const interval = setInterval(checkActiveThenLoadQueue, 6000);
    return () => clearInterval(interval);
  }, [isOnline, checkActiveThenLoadQueue]);

  async function toggleOnline() {
    setAcceptError(null);
    setTogglingOnline(true);
    try {
      if (isOnline) {
        geo.stop();
        await sendPresence(false);
        setIsOnline(false);
      } else {
        setIsOnline(true);
        geo.start();
        await sendPresence(true, geo.location);
      }
    } finally {
      setTogglingOnline(false);
    }
  }

  async function handleAccept(id: string) {
    setAcceptError(null);
    setAcceptingId(id);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/courier-requests/${id}/accept`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't accept this request.");
      }
      // Clear immediately on success too — don't wait up to 6s for the
      // next poll to notice there's an active job now.
      setRequests([]);
      hiddenUntilRef.current = {};
      router.push("/dashboard/active");
    } catch (err: any) {
      setAcceptError(err.message || "Couldn't accept this request.");
      // Someone else may have taken it — refresh the list either way.
      checkActiveThenLoadQueue();
    } finally {
      setAcceptingId(null);
    }
  }

  // Visible requests exclude anything still inside its post-timeout
  // cooldown window.
  const now = Date.now();
  const visibleRequests = requests.filter((r) => {
    const until = hiddenUntilRef.current[r._id];
    return !until || until <= now;
  });
  const topRequest = visibleRequests[0] ?? null;

  // Drive the accept window for whichever request is currently on top.
  // No visible countdown — the UI just drains a fill over this duration —
  // and once the window closes the card is hidden for a cooldown period
  // rather than declined server-side (no decline endpoint exists yet).
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (!topRequest) return;

    const requestId = topRequest._id;
    timeoutRef.current = setTimeout(() => {
      hiddenUntilRef.current[requestId] = Date.now() + HIDE_AFTER_TIMEOUT_MS;
      setHiddenTick((t) => t + 1);
    }, ACCEPT_WINDOW_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [topRequest?._id]);

  // Bring cooldown requests back once their window passes, so the queue
  // doesn't get permanently stuck skipping them if nothing else comes in.
  useEffect(() => {
    const pending = Object.values(hiddenUntilRef.current);
    if (pending.length === 0) return;
    const soonest = Math.min(...pending);
    const delay = Math.max(soonest - Date.now(), 0) + 50;
    const id = setTimeout(() => {
      const nowTs = Date.now();
      for (const key of Object.keys(hiddenUntilRef.current)) {
        if (hiddenUntilRef.current[key] <= nowTs) delete hiddenUntilRef.current[key];
      }
      setHiddenTick((t) => t + 1);
    }, delay);
    return () => clearTimeout(id);
  }, [hiddenTick, requests]);

  return (
    <RiderStatusContext.Provider
      value={{
        isOnline,
        togglingOnline,
        toggleOnline,
        location: geo.location,
        permissionState: geo.permissionState,
        geoError: geo.error,
        requests: visibleRequests,
        topRequest,
        acceptingId,
        acceptError,
        handleAccept,
        acceptWindowMs: ACCEPT_WINDOW_MS,
      }}
    >
      {children}
    </RiderStatusContext.Provider>
  );
}

export function useRiderStatus() {
  const ctx = useContext(RiderStatusContext);
  if (!ctx) {
    throw new Error("useRiderStatus must be used within a RiderStatusProvider");
  }
  return ctx;
}