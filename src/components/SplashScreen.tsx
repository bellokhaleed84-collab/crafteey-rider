"use client";

import { useEffect, useState } from "react";

interface SplashScreenProps {
  onFinished?: () => void;
  // How long the intro (draw-in + wordmark) animation takes before the
  // splash is *allowed* to exit. It will never exit before this even if
  // `ready` is already true — this guarantees the brand moment always
  // plays once. After this, if `ready` is still false, a waiting
  // indicator loops until `ready` flips true.
  introMs?: number;
  // Pass false while the app is still resolving auth/dashboard data.
  // Defaults to true so the component still works standalone.
  ready?: boolean;
}

const EXIT_MS = 400;

export default function SplashScreen({ onFinished, introMs = 2200, ready = true }: SplashScreenProps) {
  const [introDone, setIntroDone] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Intro always plays fully at least once.
  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), introMs);
    return () => clearTimeout(t);
  }, [introMs]);

  // Only exit once BOTH the intro has played AND the app says it's ready.
  useEffect(() => {
    if (introDone && ready && !exiting) {
      setExiting(true);
      const t = setTimeout(() => onFinished?.(), EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [introDone, ready, exiting, onFinished]);

  const waiting = introDone && !ready && !exiting;

  return (
    <div className={`splash-root ${exiting ? "splash-exiting" : ""}`}>
      <div className="splash-icons" aria-hidden="true">
        <BikeIcon className="si si-1" />
        <MotoIcon className="si si-2" />
        <CargoIcon className="si si-3" />
        <BurgerIcon className="si si-4" />
        <BikeIcon className="si si-5" />
        <CargoIcon className="si si-6" />
        <MotoIcon className="si si-7" />
        <BurgerIcon className="si si-8" />
        <BikeIcon className="si si-9" />
        <CargoIcon className="si si-10" />
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

      <div className={`splash-waiting ${waiting ? "splash-waiting-visible" : ""}`} aria-hidden="true">
        <div className="splash-waiting-track">
          <div className="splash-waiting-arrow" />
        </div>
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
          color: #ffffff;
        }

        .si {
          position: absolute;
          opacity: 0.08;
          animation: si-float 6s ease-in-out infinite;
        }
        .si-1 { top: 10%; left: 12%; width: 34px; transform: rotate(-8deg); animation-delay: 0s; }
        .si-2 { top: 18%; left: 78%; width: 30px; transform: rotate(10deg); animation-delay: 0.6s; }
        .si-3 { top: 68%; left: 8%; width: 28px; transform: rotate(4deg); animation-delay: 1.2s; }
        .si-4 { top: 76%; left: 82%; width: 26px; transform: rotate(-6deg); animation-delay: 1.8s; }
        .si-5 { top: 40%; left: 4%; width: 22px; transform: rotate(12deg); animation-delay: 2.4s; }
        .si-6 { top: 8%; left: 48%; width: 24px; transform: rotate(-10deg); animation-delay: 3s; }
        .si-7 { top: 84%; left: 42%; width: 28px; transform: rotate(6deg); animation-delay: 0.3s; }
        .si-8 { top: 52%; left: 90%; width: 24px; transform: rotate(-4deg); animation-delay: 1.5s; }
        .si-9 { top: 30%; left: 62%; width: 20px; transform: rotate(14deg); animation-delay: 2.1s; }
        .si-10 { top: 60%; left: 30%; width: 22px; transform: rotate(-12deg); animation-delay: 2.7s; }

        @keyframes si-float {
          0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); }
          50% { transform: translateY(-8px) rotate(var(--r, 0deg)); }
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

        .splash-waiting {
          position: relative;
          height: 6px;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .splash-waiting-visible {
          opacity: 1;
        }
        .splash-waiting-track {
          position: relative;
          width: 48px;
          height: 6px;
        }
        .splash-waiting-arrow {
          position: absolute;
          top: 0;
          left: 0;
          width: 10px;
          height: 6px;
          border-radius: 2px;
          background: #ff8900;
          animation: waiting-to-fro 1.1s ease-in-out infinite;
        }

        @keyframes waiting-to-fro {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(38px); }
        }

        @keyframes splash-draw-c { to { stroke-dashoffset: 0; } }
        @keyframes splash-chevrons-in { to { opacity: 1; transform: scale(1); } }
        @keyframes splash-mark-settle { from { transform: scale(1.15); } to { transform: scale(1); } }
        @keyframes splash-word-in { to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function BikeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M5.5 17.5 L10 8 h4 M10 8 L14 17.5 M14 17.5 L18.5 17.5 M14 17.5 L9 12 h5" />
    </svg>
  );
}

function MotoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="5" cy="17" r="3" />
      <circle cx="19" cy="17" r="3" />
      <path d="M5 17 L9 11 H15 L19 17 M9 11 L7 7 H4 M12 11 V8" />
    </svg>
  );
}

function CargoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 8 L12 4 L21 8 L12 12 Z" />
      <path d="M3 8 V16 L12 20 V12 M21 8 V16 L12 20" />
    </svg>
  );
}

function BurgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 10 a8 5 0 0 1 16 0 Z" />
      <path d="M3.5 13 h17" />
      <path d="M4 16 h16 a1 1 0 0 1 -1 2 H5 a1 1 0 0 1 -1 -2 Z" />
    </svg>
  );
}