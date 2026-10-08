"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  getGoogleMapsDirectionsUrl,
  getPreferGoogleMaps,
  type GoogleTravelMode,
} from "@/lib/navigation";

const POS_KEY = "crafteey_rider_gmaps_fab_pos";
const SIZE = 52;
const EDGE = 8;
const TAP_SLOP = 6;

interface GoogleMapsFabProps {
  lat: number;
  lng: number;
  travelMode?: GoogleTravelMode;
}

interface Pos {
  x: number;
  y: number;
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

// A round, draggable button that opens Google Maps to the next stop.
// Sits on top of a map box (its parent must be position: relative).
export default function GoogleMapsFab({ lat, lng, travelMode = "driving" }: GoogleMapsFabProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  // Position is kept as a share (0..1) of the free space, so it survives
  // different screen sizes.
  const [pos, setPos] = useState<Pos>({ x: 1, y: 0.14 });
  const posRef = useRef<Pos>(pos);
  const [highlight, setHighlight] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    setHighlight(getPreferGoogleMaps());
    try {
      const raw = window.localStorage.getItem(POS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved?.x === "number" && typeof saved?.y === "number") {
        const next = { x: clamp01(saved.x), y: clamp01(saved.y) };
        posRef.current = next;
        setPos(next);
      }
    } catch {
      // ignore - falls back to the default spot
    }
  }, []);

  function openGoogleMaps() {
    window.open(getGoogleMapsDirectionsUrl(lat, lng, travelMode), "_blank", "noopener,noreferrer");
  }

  function freeSpace() {
    const rect = boxRef.current?.getBoundingClientRect();
    return {
      w: Math.max(1, (rect?.width ?? 0) - SIZE - EDGE * 2),
      h: Math.max(1, (rect?.height ?? 0) - SIZE - EDGE * 2),
    };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // not fatal
    }
    const { w, h } = freeSpace();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: posRef.current.x * w,
      startTop: posRef.current.y * h,
      moved: false,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
    }
    const { w, h } = freeSpace();
    const next = { x: clamp01((d.startLeft + dx) / w), y: clamp01((d.startTop + dy) / h) };
    posRef.current = next;
    setPos(next);
  }

  function onPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (d.moved) {
      try {
        window.localStorage.setItem(POS_KEY, JSON.stringify(posRef.current));
      } catch {
        // position just will not be remembered
      }
    } else {
      openGoogleMaps();
    }
  }

  function onPointerCancel() {
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0 z-20">
      <button
        type="button"
        aria-label="Open in Google Maps"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openGoogleMaps();
          }
        }}
        className={`pointer-events-auto absolute flex items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 ${
          dragging ? "scale-110" : "active:scale-95"
        }`}
        style={{
          width: SIZE,
          height: SIZE,
          left: `calc(${EDGE}px + (100% - ${SIZE + EDGE * 2}px) * ${pos.x})`,
          top: `calc(${EDGE}px + (100% - ${SIZE + EDGE * 2}px) * ${pos.y})`,
          touchAction: "none",
        }}
      >
        {highlight && (
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brand-accent/30" />
        )}
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" className="relative">
          <path
            d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"
            fill="#EA4335"
          />
          <circle cx="12" cy="9" r="2.8" fill="#ffffff" />
        </svg>
      </button>
    </div>
  );
}