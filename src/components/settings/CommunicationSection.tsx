"use client";

export default function CommunicationSection() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-brand">Contacting customers</p>
        <p className="mt-1 text-xs text-steel">
          Once you accept a request, the customer's name and phone number are revealed so you can call or message
          them directly about the pickup or drop-off.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-brand">Keep it professional</p>
        <ul className="mt-2 space-y-1.5 text-xs text-steel">
          <li>• Only contact customers about the active delivery.</li>
          <li>• Don't ask customers to pay you outside the app for Hub orders.</li>
        </ul>
      </div>
    </div>
  );
}