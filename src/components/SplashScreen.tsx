"use client";

import { useEffect, useState } from "react";
import "./splash.css";

interface SplashScreenProps {
  onFinished?: () => void;
  introMs?: number;
  ready?: boolean;
}

const EXIT_MS = 250;

// Every starting style is inline on purpose: the purple screen and the small
// logo are correct from the very first paint, even before any stylesheet or
// script has loaded. The CSS file only adds the animations.
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
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 40%, #4300b8 0%, #3f04ac 55%, #2e0086 100%)",
        backgroundColor: "#3f04ac",
        overflow: "hidden",
        opacity: exiting ? 0 : 1,
        pointerEvents: exiting ? "none" : "auto",
        transition: `opacity ${EXIT_MS}ms ease-in`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: "translateY(-4vh)",
        }}
      >
        <svg
          className="splash-mark"
          viewBox="225 245 575 530"
          aria-hidden="true"
          style={{
            width: "min(24vw, 120px)",
            height: "auto",
            display: "block",
            opacity: 0,
            transform: "scale(0.7)",
          }}
        >
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

        <div
          className="splash-word"
          style={{
            marginTop: "7vh",
            fontFamily: "var(--font-inter), sans-serif",
            fontWeight: 600,
            fontSize: "min(9.5vw, 40px)",
            letterSpacing: "0.01em",
            color: "#ffffff",
            opacity: 0,
            transform: "translateY(8px)",
          }}
        >
          crafteey
        </div>
        <div
          className="splash-sub"
          style={{
            marginTop: 4,
            fontFamily: "var(--font-inter), sans-serif",
            fontWeight: 400,
            fontSize: "min(4.6vw, 18px)",
            letterSpacing: "0.3em",
            paddingLeft: "0.3em",
            color: "rgba(255, 255, 255, 0.85)",
            opacity: 0,
            transform: "translateY(8px)",
          }}
        >
          riders
        </div>
      </div>
    </div>
  );
}