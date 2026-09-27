"use client";

export default function DeliveryRequestsSection() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-brand">How requests are matched</p>
        <p className="mt-1 text-xs text-steel">
          You're shown new delivery requests that match your registered vehicle type, in the order they come in.
          There's no distance or job-type filter to configure yet.
        </p>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs text-amber-800">
          Controls like a maximum pickup distance or preferred delivery types are coming soon.
        </p>
      </div>
    </div>
  );
}