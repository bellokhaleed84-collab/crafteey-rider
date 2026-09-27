"use client";

import { useEffect, useState } from "react";

interface SplashScreenProps {
  onFinished?: () => void;
  // Total time the splash stays visible before calling onFinished —
  // matches the ~6s feel of the reference video, but shortened is fine
  // for a real loading screen; this is just how long it's shown, not
  // tied to actual data-loading time.
  durationMs?: number;
}

export default function SplashScreen({ onFinished, durationMs = 2200 }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onFinished?.();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onFinished]);

  if (!visible) return null;

  return (
    <div className="splash-root">
      <svg
        className="splash-mark"
        width="96"
        height="96"
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Blue "C" outline — stroke-drawn in via dash-offset animation */}
        <path
          className="splash-c-path"
          d="M64 20 H40 C27 20 17 30 17 48 C17 66 27 76 40 76 H64"
          stroke="#4B3BE0"
          strokeWidth="14"
          strokeLinecap="square"
          fill="none"
        />
        {/* Three orange chevrons, scaling/fading in from center */}
        <g className="splash-chevrons">
          <polyline points="34,32 46,48 34,64" stroke="#F2913D" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="46,32 58,48 46,64" stroke="#F2913D" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="58,32 70,48 58,64" stroke="#F2913D" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
          background: radial-gradient(circle at 50% 30%, #dbe9f4 0%, #a9c7dd 55%, #8fb6d4 100%);
          animation: splash-fade-out 0.4s ease-in ${durationMs - 400}ms forwards;
        }

        .splash-mark {
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
          font-family: var(--font-space-grotesk), sans-serif;
          font-weight: 700;
          font-size: 28px;
          opacity: 0;
          transform: translateY(6px);
          animation: splash-word-in 0.5s ease-out 1.5s forwards;
        }

        .splash-word-blue {
          color: #4b3be0;
        }

        .splash-word-orange {
          color: #f2913d;
        }

        @keyframes splash-draw-c {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes splash-chevrons-in {
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes splash-mark-settle {
          from {
            transform: scale(1.15);
          }
          to {
            transform: scale(1);
          }
        }

        @keyframes splash-word-in {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes splash-fade-out {
          to {
            opacity: 0;
            visibility: hidden;
          }
        }
      `}</style>
    </div>
  );
}