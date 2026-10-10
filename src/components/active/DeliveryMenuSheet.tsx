"use client";

import type { ReactNode } from "react";
import { AlertTriangle, ChevronRight, Flag, LogOut } from "lucide-react";

export type MenuChoice = "emergency" | "problem" | "giveup";

function MenuRow({
  icon,
  title,
  subtitle,
  tone,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  tone: "red" | "plain" | "danger";
  onClick: () => void;
}) {
  const style =
    tone === "red"
      ? "bg-red-600 text-white"
      : tone === "danger"
        ? "border border-red-200 text-red-600"
        : "border border-slate-200 text-slate-700";
  const sub = tone === "red" ? "text-white/80" : "text-slate-400";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-transform duration-150 active:scale-[0.98] ${style}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-extrabold leading-tight">{title}</span>
        <span className={`block text-xs font-medium ${sub}`}>{subtitle}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 opacity-60" />
    </button>
  );
}

// Slides up from the bottom with the help choices for the active delivery.
export default function DeliveryMenuSheet({
  canGiveUp,
  onPick,
  onClose,
}: {
  canGiveUp: boolean;
  onPick: (choice: MenuChoice) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/50" onClick={onClose}>
      <style>{`@keyframes menu-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <div
        className="w-full rounded-t-3xl bg-white p-5"
        style={{
          paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
          animation: "menu-sheet-up 0.28s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300" />
        <h2 className="text-lg font-extrabold text-brand">Delivery help</h2>

        <div className="mt-4 space-y-3">
          <MenuRow
            tone="red"
            icon={<AlertTriangle className="h-7 w-7" />}
            title="SOS"
            subtitle="Call 112 or alert Crafteey"
            onClick={() => onPick("emergency")}
          />
          <MenuRow
            tone="plain"
            icon={<Flag className="h-6 w-6" />}
            title="Report a problem"
            subtitle="See what to do and who to call"
            onClick={() => onPick("problem")}
          />
          {canGiveUp && (
            <MenuRow
              tone="danger"
              icon={<LogOut className="h-6 w-6" />}
              title="Give up job"
              subtitle="Only possible before pickup"
              onClick={() => onPick("giveup")}
            />
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 min-h-[52px] w-full rounded-xl py-3 text-sm font-semibold text-steel"
        >
          Close
        </button>
      </div>
    </div>
  );
}