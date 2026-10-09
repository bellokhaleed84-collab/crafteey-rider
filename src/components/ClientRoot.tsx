"use client";

import { useState } from "react";
import SplashScreen from "@/components/SplashScreen";
import BackButtonHandler from "@/components/BackButtonHandler";
import NativeSetup from "@/components/NativeSetup";
import { useAuth } from "@/contexts/AuthContext";

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);
  const { loading: authLoading } = useAuth();

  return (
    <>
      <BackButtonHandler />
      <NativeSetup />
      {showSplash && (
        <SplashScreen ready={!authLoading} onFinished={() => setShowSplash(false)} />
      )}
      {children}
    </>
  );
}