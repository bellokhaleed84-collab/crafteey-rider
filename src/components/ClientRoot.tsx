"use client";

import { useState } from "react";
import SplashScreen from "@/components/SplashScreen";
import { useAuth } from "@/contexts/AuthContext";

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);
  const { loading: authLoading } = useAuth(); // <-- tell me if this field is named differently

  return (
    <>
      {showSplash && (
        <SplashScreen ready={!authLoading} onFinished={() => setShowSplash(false)} />
      )}
      {children}
    </>
  );
}