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