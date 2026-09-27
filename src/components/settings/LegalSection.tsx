"use client";

const DOCS = [
  { label: "Terms of Service", href: "#" },
  { label: "Privacy Policy", href: "#" },
  { label: "Rider Agreement", href: "#" },
];

export default function LegalSection() {
  return (
    <div className="space-y-2">
      {DOCS.map((d) => (
        <a
          key={d.label}
          href={d.href}
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-brand"
        >
          {d.label} <span>→</span>
        </a>
      ))}
      <p className="text-[11px] text-steel">
        These links are placeholders (<code>#</code>) — point them at your actual hosted documents once they exist.
        I can't write real legal text for you here.
      </p>
    </div>
  );
}