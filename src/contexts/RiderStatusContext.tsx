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
  vehicleType: string;
  riderEarningKobo?: number | null;
  orderNumber?: string | null;
  vendorName?: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
}

const ACCEPT_WINDOW_MS = 8000;
// Local cooldown before a re-poll could show this card again — now just
// a safety net for the gap between the decline call landing and the
// next poll, not the primary decline mechanism.
const HIDE_AFTER_TIMEOUT_MS = 20000;

interface RiderStatusContextType {
  isOnline: boolean;
  togglingOnline: boolean;
  initializing: boolean;
  toggleOnline: () => Promise<void>;
  onlineError: string | null;
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

export function RiderStatusProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { getIdToken } = useAuth();

  const [isOnline, setIsOnline] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  // True until the initial "am I already online?" check has resolved.
  // Lets the dashboard show a skeleton instead of briefly flashing
  // "You're offline" before this fetch comes back.
  const [initializing, setInitializing] = useState(true);

  const [requests, setRequests] = useState<QueueRequest[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const hiddenUntilRef = useRef<Record<string, number>>({});
  const [hiddenTick, setHiddenTick] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Returns whether the server actually accepted the presence change,
  // instead of silently swallowing both network errors and non-2xx
  // responses like the previous version did. Callers decide what to do
  // with a failure — the periodic GPS ping below ignores it (a dropped
  // ping isn't worth interrupting an active rider over), but the
  // explicit toggleOnline() call below needs to know, since a rejected
  // "go online" (e.g. the rider is suspended) must NOT flip the UI to
  // online or start burning battery on a location watch.
  async function sendPresence(
    next: boolean,
    coords?: LatLng | null
  ): Promise<{ ok: boolean; error?: string }> {
    const token = await getIdToken();
    if (!token) return { ok: false, error: "You're not signed in." };
    try {
      const res = await fetch("/api/couriers/online", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isOnline: next, location: coords ?? null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.error || "Couldn't update your status." };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Couldn't reach the server. Check your connection." };
    }
  }

  const geo = useGeolocation({
    // Fire-and-forget on purpose — a dropped periodic location ping
    // while already online shouldn't flip the rider offline or show an
    // error; it'll just succeed on the next tick.
    onThrottledUpdate: (coords) => {
      sendPresence(true, coords);
    },
  });

  useEffect(() => {
    (async () => {
      const token = await getIdToken();
      if (!token) {
        setInitializing(false);
        return;
      }
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
      setInitializing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkActiveThenLoadQueue = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;

    const activeRes = await fetch("/api/courier-requests/active", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const activeData = await activeRes.json().catch(() => ({}));
    if (activeData.request) {
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
    setOnlineError(null);
    setTogglingOnline(true);
    try {
      if (isOnline) {
        geo.stop();
        const result = await sendPresence(false);
        // Going offline failing server-side is rare and low-stakes —
        // still flip the local UI to offline so the rider isn't stuck
        // mid-shift, but let them know the server didn't confirm it.
        if (!result.ok) {
          setOnlineError(result.error ?? "Couldn't confirm you're offline. Try again if this persists.");
        }
        setIsOnline(false);
      } else {
        const result = await sendPresence(true, geo.location);
        if (!result.ok) {
          // The server rejected going online (e.g. account suspended
          // for outstanding debt) — surface it and stop here. Do NOT
          // flip isOnline or start the location watch.
          setOnlineError(result.error ?? "Couldn't go online.");
          return;
        }
        setIsOnline(true);
        geo.start();
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
      setRequests([]);
      hiddenUntilRef.current = {};
      router.push("/dashboard/active");
    } catch (err: any) {
      setAcceptError(err.message || "Couldn't accept this request.");
      checkActiveThenLoadQueue();
    } finally {
      setAcceptingId(null);
    }
  }

  // Fire-and-forget: tells the server this rider is done with this
  // specific request so it stops being offered to them, without
  // affecting other riders who can still see and accept it.
  const declineOnServer = useCallback(
    async (id: string) => {
      const token = await getIdToken();
      if (!token) return;
      fetch(`/api/courier-requests/${id}/decline`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    },
    [getIdToken]
  );

  const now = Date.now();
  const visibleRequests = requests.filter((r) => {
    const until = hiddenUntilRef.current[r._id];
    return !until || until <= now;
  });
  const topRequest = visibleRequests[0] ?? null;

  // Drive the accept window for whichever request is currently on top.
  // On timeout: hide it locally right away (instant UI feedback) AND
  // tell the server to decline it on this rider's behalf, so the next
  // poll for every OTHER matching rider still shows it, but this rider
  // never sees it resurface once the local cooldown clears.
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
      declineOnServer(requestId);
    }, ACCEPT_WINDOW_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [topRequest?._id, declineOnServer]);

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
        initializing,
        toggleOnline,
        onlineError,
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