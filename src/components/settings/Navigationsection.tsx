"use client";

import { useEffect, useState } from "react";

const NAV_APP_KEY = "crafteey_rider_nav_app";
const OPTIONS = [
  { id: "google_maps", label: "Google Maps" },
  { id: "waze", label: "Waze" },
  { id: "apple_maps", label: "Apple Maps" },
];

export default function NavigationSection() {
  const [selected, setSelected] = useState("google_maps");

  useEffect(() => {
    const saved = localStorage.getItem(NAV_APP_KEY);
    if (saved) setSelected(saved);
  }, []);

  function select(id: string) {
    setSelected(id);
    localStorage.setItem(NAV_APP_KEY, id);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-steel">
        Choose which app opens when you tap "Get directions" to a pickup or drop-off.
      </p>
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          onClick={() => select(o.id)}
          className={`flex w-full items-center justify-between rounded-2xl border p-4 text-sm font-semibold ${
            selected === o.id ? "border-brand bg-brand/5 text-brand" : "border-slate-200 bg-white text-brand"
          }`}
        >
          {o.label}
          {selected === o.id && <span>✓</span>}
        </button>
      ))}
      <p className="text-[11px] text-steel">
        Saved on this device only. Wiring this into the actual "Get directions" button needs whatever file builds
        that link (looks like it'd be lib/navigation.ts or lib/directions.ts in your tree) — share it and I'll
        connect it.
      </p>
    </div>
  );
}