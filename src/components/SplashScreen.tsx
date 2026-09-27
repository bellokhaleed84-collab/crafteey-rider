"use client";

import { useEffect, useState } from "react";

interface SplashScreenProps {
  onFinished?: () => void;
  introMs?: number;
  ready?: boolean;
}

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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/crafteey-logo-mark.png"
        alt=""
        width={96}
        height={96}
        className="splash-mark"
      />

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

        .splash-mark {
          position: relative;
          opacity: 0;
          animation: splash-mark-in 0.7s ease-out 0.6s forwards;
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

        @keyframes splash-mark-in {
          from { opacity: 0; transform: scale(0.6) rotate(-8deg); }
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        @keyframes splash-word-in { to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}