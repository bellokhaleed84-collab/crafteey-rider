"use client";

export default function AboutSection() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
        <p className="text-sm font-bold text-brand">Crafteey Rider</p>
        {/* Placeholder version — wire this to your actual build/version string if you track one. */}
        <p className="mt-1 text-xs text-steel">Version 1.0.0</p>
      </div>
      <p className="text-center text-[11px] text-steel">
        © {new Date().getFullYear()} Crafteey. All rights reserved.
      </p>
    </div>
  );
}