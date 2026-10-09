"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import RiderCardView from "@/components/RiderCardView";

type Card = { _id: string; title: string; message: string; icon: string; color: string };

// Cards go on and off with their time window, so ask again every few minutes.
const REFRESH_MS = 5 * 60 * 1000;

export default function HomeCards() {
  const { getIdToken } = useAuth();
  const [cards, setCards] = useState<Card[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await getIdToken();
        if (!token) {
          if (!cancelled) setCards((prev) => prev ?? []);
          return;
        }
        const res = await fetch("/api/rider-content/home-cards", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const d = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(d.cards)) setCards(d.cards);
        else if (!cancelled) setCards((prev) => prev ?? []);
      } catch {
        if (!cancelled) setCards((prev) => prev ?? []);
      }
    }

    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [getIdToken]);

  if (cards === null) return <div className="h-20 animate-pulse rounded-2xl bg-slate-200" aria-busy="true" />;
  if (cards.length === 0) return null;

  return (
    <div className="space-y-3">
      {cards.map((c) => (
        <RiderCardView key={c._id} title={c.title} message={c.message} icon={c.icon} color={c.color} />
      ))}
    </div>
  );
}