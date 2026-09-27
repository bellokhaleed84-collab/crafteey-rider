"use client";

export default function SafetySection() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-bold text-red-700">In an emergency</p>
        <p className="mt-1 text-xs text-red-600">Call the police or emergency services immediately.</p>
        {/* 112 is Nigeria's national emergency line — swap for a support
            hotline if you'd rather riders call Crafteey support instead. */}
        <a href="tel:112" className="mt-3 block rounded-xl bg-red-600 py-2.5 text-center text-sm font-bold text-white">
          Call emergency services
        </a>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-brand">Safety tips</p>
        <ul className="mt-2 space-y-1.5 text-xs text-steel">
          <li>• Confirm the pickup and drop-off match what's shown in the app before handing over a package.</li>
          <li>• Wear your helmet and reflective gear at all times.</li>
          <li>• You can decline a request if a location feels unsafe.</li>
        </ul>
      </div>
    </div>
  );
}