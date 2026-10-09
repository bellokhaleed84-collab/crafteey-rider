"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export interface DetailRow {
  label: string;
  value: ReactNode;
}

export function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A bottom sheet that slides up over the Activity page.
export default function DetailSheet({
  title,
  subtitle,
  amountText,
  amountClass,
  badgeText,
  badgeClass,
  sections,
  note,
  onClose,
}: {
  title: string;
  subtitle?: string;
  amountText?: string;
  amountClass?: string;
  badgeText?: string;
  badgeClass?: string;
  sections: DetailRow[][];
  note?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />

      <div
        className="relative flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-[0_-12px_32px_rgba(0,0,0,0.25)]"
        style={{ animation: "sheet-slide-up 0.3s ease-out" }}
      >
        <div className="shrink-0 px-5 pt-3">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold text-brand">{title}</p>
              {subtitle ? <p className="mt-0.5 text-xs text-steel">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-brand"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {(amountText || badgeText) && (
            <div className="mt-3 flex items-center justify-between gap-3">
              {amountText ? (
                <p className={`text-2xl font-extrabold ${amountClass ?? "text-brand"}`}>{amountText}</p>
              ) : (
                <span />
              )}
              {badgeText ? (
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeClass ?? "bg-slate-100 text-steel"}`}>
                  {badgeText}
                </span>
              ) : null}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 pb-2 pt-4">
          {sections.map((rows, i) =>
            rows.length === 0 ? null : (
              <div key={i} className="divide-y divide-slate-100 rounded-xl border border-slate-100 px-3">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-start justify-between gap-4 py-2.5">
                    <p className="shrink-0 text-xs text-steel">{r.label}</p>
                    <div className="min-w-0 text-right text-xs font-semibold text-brand">{r.value}</div>
                  </div>
                ))}
              </div>
            )
          )}
          {note ? <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-600">{note}</p> : null}
        </div>

        <div className="shrink-0 px-5 pt-2" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-brand py-3 text-sm font-bold text-white active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}