"use client";

import { useEffect, useState, type ComponentType } from "react";
import { Check, Map as MapIcon, Navigation } from "lucide-react";
import { getPreferGoogleMaps, setPreferGoogleMaps } from "@/lib/navigation";

type NavChoice = "in_app" | "google";

const OPTIONS: {
  id: NavChoice;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    id: "in_app",
    label: "In-app navigation",
    description: "Follow your route on the Crafteey map. Arrows show the way along each street.",
    icon: Navigation,
  },
  {
    id: "google",
    label: "Google Maps",
    description: "Use Google Maps for turn-by-turn directions. The Maps button on the map will be highlighted.",
    icon: MapIcon,
  },
];

export default function NavigationSection() {
  const [selected, setSelected] = useState<NavChoice>("in_app");

  useEffect(() => {
    setSelected(getPreferGoogleMaps() ? "google" : "in_app");
  }, []);

  function select(id: NavChoice) {
    setSelected(id);
    setPreferGoogleMaps(id === "google");
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-steel">Choose how you want to be guided to pickups and drop-offs.</p>

      {OPTIONS.map((o) => {
        const Icon = o.icon;
        const on = selected === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => select(o.id)}
            className={`flex min-h-[76px] w-full items-center gap-3 rounded-2xl border p-4 text-left ${
              on ? "border-brand bg-brand/5" : "border-slate-200 bg-white"
            }`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunshine text-brand">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-brand">{o.label}</span>
              <span className="mt-0.5 block text-xs text-steel">{o.description}</span>
            </span>
            {on && <Check className="h-5 w-5 shrink-0 text-brand" />}
          </button>
        );
      })}

      <p className="text-[11px] text-steel">
        Whichever you pick, the round Maps button on the map opens Google Maps to your next stop. You can drag it
        anywhere on the screen. Saved on this device.
      </p>
    </div>
  );
}