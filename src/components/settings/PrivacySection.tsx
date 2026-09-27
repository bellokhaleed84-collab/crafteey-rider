"use client";

export default function PrivacySection() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-brand">Your data</p>
        <p className="mt-1 text-xs text-steel">
          We use your location only while you're online, to match you with nearby delivery requests. Your ID and
          vehicle details are used for account verification.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-brand">Account deletion</p>
        <p className="mt-1 text-xs text-steel">To delete your account and associated data, contact support.</p>
      </div>
    </div>
  );
}