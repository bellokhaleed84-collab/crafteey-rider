"use client";

import { useRiderStatus } from "@/contexts/RiderStatusContext";

export default function AvailabilitySection() {
  const { isOnline, togglingOnline, toggleOnline, onlineError } = useRiderStatus();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-brand">{isOnline ? "You're online" : "You're offline"}</p>
            <p className="mt-1 text-xs text-steel">
              {isOnline
                ? "You can receive new delivery requests right now."
                : "Go online to start receiving delivery requests."}
            </p>
          </div>
          <button
            onClick={toggleOnline}
            disabled={togglingOnline}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50 ${
              isOnline ? "bg-red-50 text-red-600" : "bg-emerald-500 text-white"
            }`}
          >
            {togglingOnline ? "…" : isOnline ? "Go offline" : "Go online"}
          </button>
        </div>
        {onlineError && <p className="mt-3 text-xs text-red-600">{onlineError}</p>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs text-steel">
          You can also toggle this from the home screen. Being online uses your device's location to match you with
          nearby requests.
        </p>
      </div>
    </div>
  );
}