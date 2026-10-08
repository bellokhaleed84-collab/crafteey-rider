"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

interface SlideButtonProps {
  label: string;
  onComplete: () => void | Promise<void>;
  disabled?: boolean;
  tone?: "dark" | "green";
}

const HANDLE_PX = 48;
const PAD_PX = 4;
const TRIGGER_RATIO = 0.85;

// Slide-to-confirm button. Drag the yellow handle most of the way across to
// fire onComplete. Enter or Space on the handle also fires it (desktop testing).
export default function SlideButton({
  label,
  onComplete,
  disabled = false,
  tone = "dark",
}: SlideButtonProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number | null>(null);
  const xRef = useRef(0);
  const mountedRef = useRef(true);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function maxX(): number {
    const w = trackRef.current?.offsetWidth ?? 0;
    return Math.max(w - HANDLE_PX - PAD_PX * 2, 0);
  }

  function moveTo(v: number) {
    xRef.current = v;
    setX(v);
  }

  async function fire() {
    if (busy || disabled) return;
    setBusy(true);
    moveTo(maxX());
    try {
      await onComplete();
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        moveTo(0);
      }
    }
  }

  function onDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = e.clientX - xRef.current;
    setDragging(true);
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (startRef.current === null) return;
    moveTo(Math.min(Math.max(e.clientX - startRef.current, 0), maxX()));
  }

  function onUp() {
    if (startRef.current === null) return;
    startRef.current = null;
    setDragging(false);
    const m = maxX();
    if (m > 0 && xRef.current >= m * TRIGGER_RATIO) {
      void fire();
    } else {
      moveTo(0);
    }
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void fire();
    }
  }

  const trackW = trackRef.current?.offsetWidth ?? 0;
  const range = Math.max(trackW - HANDLE_PX - PAD_PX * 2, 1);
  const labelOpacity = busy ? 1 : Math.max(1 - (x / range) * 1.2, 0.15);

  return (
    <div
      ref={trackRef}
      className="relative h-14 w-full select-none overflow-hidden rounded-full"
      style={{
        backgroundColor: tone === "green" ? "#059669" : "#15181F",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: x + HANDLE_PX + PAD_PX * 2,
          backgroundColor: "rgba(245,197,66,0.30)",
          transition: dragging ? "none" : "width 200ms ease",
        }}
      />
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center pl-10 text-sm font-bold text-white"
        style={{ opacity: labelOpacity }}
      >
        {busy ? "Please wait..." : label}
      </span>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onKeyDown={onKey}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="absolute flex cursor-grab items-center justify-center rounded-full shadow-md active:cursor-grabbing"
        style={{
          top: PAD_PX,
          left: PAD_PX,
          width: HANDLE_PX,
          height: HANDLE_PX,
          backgroundColor: "#F5C542",
          color: "#15181F",
          touchAction: "none",
          transform: `translateX(${x}px)`,
          transition: dragging ? "none" : "transform 200ms ease",
        }}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7l5 5-5 5M12 7l5 5-5 5" />
        </svg>
      </div>
    </div>
  );
}