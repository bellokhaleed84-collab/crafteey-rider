"use client";

import { useEffect, useState } from "react";

interface SplashScreenProps {
  onFinished?: () => void;
  introMs?: number;
  ready?: boolean;
}

const EXIT_MS = 250;

export default function SplashScreen({ onFinished, introMs = 4500, ready = true }: SplashScreenProps) {
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
      <div className="splash-stack">
        <svg className="splash-mark" viewBox="225 245 575 530" aria-hidden="true">
          <path
            fill="#ffffff"
            d="M490 250H735Q745 250 745 260V382H490A130 130 0 0 0 490 642H745V760Q745 770 735 770H490A260 260 0 0 1 490 250Z"
          />
          <g fill="#FFB400">
            <polygon points="450,405 480,405 603,515 480,621 450,621 535,513" />
            <polygon points="543,405 573,405 696,515 573,621 543,621 628,513" />
            <polygon points="636,405 666,405 790,515 666,621 636,621 722,513" />
          </g>
        </svg>

        <div className="splash-word">crafteey</div>
        <div className="splash-sub">riders</div>
      </div>

      <style jsx>{`
        .splash-root {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 50% 40%, #4300b8 0%, #3f04ac 55%, #2e0086 100%);
          overflow: hidden;
          opacity: 1;
          transition: opacity ${EXIT_MS}ms ease-in;
        }

        .splash-exiting {
          opacity: 0;
          pointer-events: none;
        }

        .splash-stack {
          display: flex;
          flex-direction: column;
          align-items: center;
          transform: translateY(-4vh);
        }

        .splash-mark {
          width: min(24vw, 120px);
          height: auto;
          opacity: 0;
          transform: scale(0.7);
          animation:
            splash-mark-in 0.7s ease-out 0.5s forwards,
            splash-glow 1.8s ease-in-out 2.2s infinite alternate;
        }

        .splash-word {
          margin-top: 7vh;
          font-family: var(--font-inter), sans-serif;
          font-weight: 600;
          font-size: min(9.5vw, 40px);
          letter-spacing: 0.01em;
          color: #ffffff;
          opacity: 0;
          transform: translateY(8px);
          animation: splash-rise 0.6s ease-out 1.2s forwards;
        }

        .splash-sub {
          margin-top: 4px;
          font-family: var(--font-inter), sans-serif;
          font-weight: 400;
          font-size: min(4.6vw, 18px);
          letter-spacing: 0.3em;
          padding-left: 0.3em;
          color: rgba(255, 255, 255, 0.85);
          opacity: 0;
          transform: translateY(8px);
          animation: splash-rise 0.6s ease-out 1.7s forwards;
        }

        @keyframes splash-mark-in {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes splash-rise {
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes splash-glow {
          from { filter: drop-shadow(0 0 0 rgba(255, 180, 0, 0)); }
          to { filter: drop-shadow(0 0 16px rgba(255, 180, 0, 0.45)); }
        }
      `}</style>
    </div>
  );
}
