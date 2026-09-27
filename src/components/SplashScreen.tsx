"use client";

import { useEffect, useState } from "react";

interface SplashScreenProps {
  onFinished?: () => void;
  // Full brand-moment duration. Always plays in full, regardless of how
  // fast auth/data resolves.
  introMs?: number;
  // Pass false while the app is still resolving auth/dashboard data.
  // If it's still false when introMs elapses, the splash holds as-is
  // (no spinner, no indicator) until it flips true, then cuts straight
  // to the dashboard.
  ready?: boolean;
}

// Intentionally short — the brief is "no visible loading", so the exit
// is a quick crossfade, not a lingering one. Set to 0 for a hard cut.
const EXIT_MS = 200;

export default function SplashScreen({ onFinished, introMs = 6000, ready = true }: SplashScreenProps) {
  const [introDone, setIntroDone] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), introMs);
    return () => clearTimeout(t);
  }, [introMs]);

  useEffect(() => {
    if (introDone && ready && !exiting) {
      setExiting(true);
      const t = setTimeout(() => onFinished?.(), EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [introDone, ready, exiting, onFinished]);

  return (
    <div className={`splash-root ${exiting ? "splash-exiting" : ""}`}>
      <div className="splash-icons" aria-hidden="true">
        {SCATTER.map((s, i) => (
          <span
            key={i}
            className="si"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.size,
              height: s.size,
              color: COLORS[s.color],
              animationDelay: `${s.delay}s`,
              transform: `rotate(${s.rotate ?? 0}deg)`,
            }}
          >
            <s.Icon />
          </span>
        ))}
      </div>

      <svg
        className="splash-mark"
        width="96"
        height="96"
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          className="splash-c-path"
          d="M64 20 H40 C27 20 17 30 17 48 C17 66 27 76 40 76 H64"
          stroke="#4A10D7"
          strokeWidth="14"
          strokeLinecap="square"
          fill="none"
        />
        <g className="splash-chevrons">
          <polyline points="32,32 44,48 32,64" stroke="#FF8900" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="44,32 56,48 44,64" stroke="#FF8900" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="56,32 68,48 56,64" stroke="#FF8900" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>

      <div className="splash-wordmark">
        <span className="splash-word-blue">Craft</span>
        <span className="splash-word-orange">ee</span>
        <span className="splash-word-blue">y</span>
      </div>

      <style jsx>{`
        .splash-root {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: #000;
          overflow: hidden;
          opacity: 1;
          transition: opacity ${EXIT_MS}ms ease-in;
        }

        .splash-exiting {
          opacity: 0;
          pointer-events: none;
        }

        .splash-icons {
          position: absolute;
          inset: 0;
        }

        .si {
          position: absolute;
          display: block;
          animation: si-float 5s ease-in-out infinite;
        }

        .si :global(svg) {
          width: 100%;
          height: 100%;
          display: block;
        }

        @keyframes si-float {
          0%, 100% { margin-top: 0; }
          50% { margin-top: -6px; }
        }

        .splash-mark {
          position: relative;
          animation: splash-mark-settle 0.6s ease-out 1.1s both;
        }

        .splash-c-path {
          stroke-dasharray: 220;
          stroke-dashoffset: 220;
          animation: splash-draw-c 1s ease-out forwards;
        }

        .splash-chevrons {
          opacity: 0;
          transform-origin: center;
          transform: scale(0.4);
          animation: splash-chevrons-in 0.5s ease-out 0.5s forwards;
        }

        .splash-wordmark {
          position: relative;
          font-family: var(--font-space-grotesk), sans-serif;
          font-weight: 700;
          font-size: 28px;
          opacity: 0;
          transform: translateY(6px);
          animation: splash-word-in 0.5s ease-out 1.5s forwards;
        }

        .splash-word-blue { color: #4a10d7; }
        .splash-word-orange { color: #ff8900; }

        @keyframes splash-draw-c { to { stroke-dashoffset: 0; } }
        @keyframes splash-chevrons-in { to { opacity: 1; transform: scale(1); } }
        @keyframes splash-mark-settle { from { transform: scale(1.15); } to { transform: scale(1); } }
        @keyframes splash-word-in { to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// --- Colors -----------------------------------------------------------
// Swap "blue" to your exact brand-accent hex if this doesn't match —
// I don't have that token's precise value on hand.
const COLORS = {
  gold: "#F5C542",
  blue: "#2F6FED",
  white: "rgba(255,255,255,0.55)",
};

type Color = keyof typeof COLORS;

// --- Icon field ---------------------------------------------------------
// top/left are % of viewport; size in px. Roughly mirrors the density
// and placement of the reference image, keeping the center clear for
// the logo + wordmark.
const SCATTER: { Icon: React.FC; color: Color; top: number; left: number; size: number; delay: number; rotate?: number }[] = [
  { Icon: SmileyIcon, color: "gold", top: 4, left: 82, size: 26, delay: 0 },
  { Icon: DotIcon, color: "blue", top: 7, left: 7, size: 6, delay: 0.3 },
  { Icon: BurgerIcon, color: "gold", top: 14, left: 28, size: 26, delay: 0.6 },
  { Icon: BikeIcon, color: "blue", top: 17, left: 6, size: 24, delay: 0.9 },
  { Icon: BowlIcon, color: "blue", top: 19, left: 82, size: 24, delay: 1.2 },
  { Icon: DotIcon, color: "gold", top: 10, left: 72, size: 6, delay: 1.5 },
  { Icon: PinIcon, color: "blue", top: 22, left: 50, size: 20, delay: 1.8 },
  { Icon: SparkleIcon, color: "gold", top: 26, left: 43, size: 18, delay: 2.1 },
  { Icon: DotIcon, color: "blue", top: 26, left: 21, size: 6, delay: 2.4 },
  { Icon: DotIcon, color: "gold", top: 30, left: 4, size: 6, delay: 2.7 },
  { Icon: SmileyIcon, color: "gold", top: 35, left: 16, size: 26, delay: 3.0 },
  { Icon: ThumbsUpIcon, color: "white", top: 33, left: 70, size: 22, delay: 3.3 },
  { Icon: SparkleIcon, color: "gold", top: 32, left: 88, size: 16, delay: 3.6 },
  { Icon: SparkleIcon, color: "gold", top: 38, left: 55, size: 16, delay: 3.9 },
  { Icon: DotIcon, color: "white", top: 40, left: 29, size: 6, delay: 4.2 },
  { Icon: FriesIcon, color: "gold", top: 43, left: 92, size: 24, delay: 4.5 },
  { Icon: BowlIcon, color: "gold", top: 48, left: 30, size: 24, delay: 4.8 },
  { Icon: BagIcon, color: "blue", top: 50, left: 6, size: 22, delay: 0.2 },
  { Icon: DotIcon, color: "blue", top: 47, left: 78, size: 6, delay: 0.5 },
  { Icon: VanIcon, color: "gold", top: 55, left: 64, size: 26, delay: 0.8 },
  { Icon: StarIcon, color: "gold", top: 57, left: 87, size: 18, delay: 1.1 },
  { Icon: DotIcon, color: "white", top: 58, left: 49, size: 6, delay: 1.4 },
  { Icon: PinIcon, color: "gold", top: 62, left: 92, size: 20, delay: 1.7 },
  { Icon: SparkleIcon, color: "gold", top: 63, left: 13, size: 16, delay: 2.0 },
  { Icon: HeartIcon, color: "white", top: 66, left: 77, size: 22, delay: 2.3 },
  { Icon: BowlIcon, color: "gold", top: 70, left: 29, size: 24, delay: 2.6 },
  { Icon: StarIcon, color: "gold", top: 72, left: 59, size: 18, delay: 2.9 },
  { Icon: DotIcon, color: "blue", top: 73, left: 5, size: 6, delay: 3.2 },
  { Icon: HeartIcon, color: "blue", top: 78, left: 46, size: 22, delay: 3.5 },
  { Icon: DotIcon, color: "blue", top: 79, left: 93, size: 6, delay: 3.8 },
  { Icon: SparkleIcon, color: "gold", top: 82, left: 15, size: 16, delay: 4.1 },
  { Icon: BikeIcon, color: "blue", top: 82, left: 85, size: 24, delay: 4.4 },
  { Icon: ThumbsUpIcon, color: "white", top: 90, left: 32, size: 22, delay: 4.7 },
  { Icon: SmileyIcon, color: "gold", top: 91, left: 66, size: 26, delay: 0.1 },
  { Icon: BurgerIcon, color: "gold", top: 93, left: 8, size: 26, delay: 0.4 },
  { Icon: DotIcon, color: "gold", top: 95, left: 79, size: 6, delay: 0.7 },
  { Icon: PinIcon, color: "blue", top: 96, left: 24, size: 20, delay: 1.0 },
  { Icon: GiftIcon, color: "gold", top: 96, left: 49, size: 24, delay: 1.3 },
  { Icon: BikeIcon, color: "blue", top: 97, left: 75, size: 24, delay: 1.6 },
  { Icon: StarIcon, color: "blue", top: 98, left: 65, size: 18, delay: 1.9 },
  { Icon: BowlIcon, color: "gold", top: 99, left: 88, size: 24, delay: 2.2 },
  { Icon: StarIcon, color: "gold", top: 99, left: 6, size: 18, delay: 2.5 },
];

// --- Icon SVGs ------------------------------------------------------------

function BikeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M5.5 17.5 L10 8 h4 M10 8 L14 17.5 M14 17.5 L18.5 17.5 M14 17.5 L9 12 h5" />
    </svg>
  );
}

function VanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 16V8h11v8" />
      <path d="M13 11h4l3 3v2h-7" />
      <circle cx="6.5" cy="17" r="1.6" />
      <circle cx="16.5" cy="17" r="1.6" />
    </svg>
  );
}

function BurgerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 10 a8 5 0 0 1 16 0 Z" />
      <path d="M3.5 13 h17" />
      <path d="M4 16 h16 a1 1 0 0 1 -1 2 H5 a1 1 0 0 1 -1 -2 Z" />
    </svg>
  );
}

function BowlIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 12 h18 a9 7 0 0 1 -18 0 Z" />
      <path d="M9 12 c0 -2 1 -2 1 -4 M12 12 c0 -2 1 -2 1 -4 M15 12 c0 -2 1 -2 1 -4" />
    </svg>
  );
}

function FriesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 10 L5 21 h14 l-1 -11 Z" />
      <path d="M8 10 V5 M11 10 V4 M14 10 V5 M17 10 V6" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 21 C7 15 5 12 5 8.5 A7 7 0 0 1 19 8.5 C19 12 17 15 12 21 Z" />
      <circle cx="12" cy="8.5" r="2.4" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2 C12.5 8 14 9.5 20 10 C14 10.5 12.5 12 12 18 C11.5 12 10 10.5 4 10 C10 9.5 11.5 8 12 2 Z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2 L14.6 9 L22 9.5 L16.2 14.1 L18.2 21.3 L12 17.3 L5.8 21.3 L7.8 14.1 L2 9.5 L9.4 9 Z" />
    </svg>
  );
}

function ThumbsUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 11 v9 H4 v-9 Z" />
      <path d="M7 11 l3.5 -7 a1.8 1.8 0 0 1 3.2 1.4 L12.5 9 H18 a2 2 0 0 1 2 2.4 l-1.2 6 A2 2 0 0 1 16.9 19 H10 a3 3 0 0 1 -3 -3 v-5 Z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 20 C6 15.5 3 12.6 3 8.9 A4.4 4.4 0 0 1 12 7.2 A4.4 4.4 0 0 1 21 8.9 C21 12.6 18 15.5 12 20 Z" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 8 h12 l1 13 H5 Z" />
      <path d="M9 8 V6 a3 3 0 0 1 6 0 v2" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="9" width="16" height="12" rx="1" />
      <path d="M4 13 h16 M12 9 v12" />
      <path d="M12 9 C9 9 8 7 9 5.5 C10 4.2 12 5 12 9 C12 5 14 4.2 15 5.5 C16 7 15 9 12 9 Z" />
    </svg>
  );
}

function SmileyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
      <path d="M8 14.5 C9.2 16.5 14.8 16.5 16 14.5" strokeLinecap="round" />
    </svg>
  );
}

function DotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}