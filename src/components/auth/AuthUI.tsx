"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";

export function CrafteeyMark({ width = 64 }: { width?: number }) {
  return (
    <svg width={width} viewBox="225 245 575 530" style={{ height: "auto" }} aria-hidden="true">
      <path
        fill="#ffffff"
        d="M490 250H735Q745 250 745 260V382H490A130 130 0 0 0 490 642H745V760Q745 770 735 770H490A260 260 0 0 1 490 250Z"
      />
      <g fill="#FFB400">
        <polygon points="450,405 480,405 603,515 480,621 450,621 535,513" />
        <polygon points="543,405 573,405 696,515 573,621 543,621 628,513" />
        <polygon points="636,405 666,405 790,515 666,621 636,621 722,513" />
      </g>
    </svg>
  );
}

export function BrandLockup({ markWidth = 56 }: { markWidth?: number }) {
  return (
    <div className="flex flex-col items-center">
      <CrafteeyMark width={markWidth} />
      <div className="mt-2 text-2xl font-semibold leading-none text-white">crafteey</div>
      <div className="mt-1 text-sm tracking-[0.3em] text-white/80">riders</div>
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-[100dvh] w-full text-white"
      style={{
        background:
          "radial-gradient(ellipse at 50% 12%, #4a0fc4 0%, #35089a 55%, #240070 100%)",
      }}
    >
      <div
        className="mx-auto flex min-h-[100dvh] max-w-sm flex-col px-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function AuthTopBar({
  onBack,
  step,
  total,
  title,
}: {
  onBack?: () => void;
  step?: number;
  total?: number;
  title?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ml-1 p-1 text-white"
        >
          <ArrowLeft size={22} />
        </button>
      ) : (
        <span className="w-6" />
      )}
      {step && total ? (
        <>
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${i < step ? "bg-[#FFC400]" : "bg-white/20"}`}
              />
            ))}
          </div>
          <span className="text-xs text-white/70">
            {step}/{total}
          </span>
        </>
      ) : title ? (
        <span className="text-base font-medium text-white">{title}</span>
      ) : null}
    </div>
  );
}

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label: string;
  icon?: ReactNode;
  leading?: ReactNode;
  right?: ReactNode;
}

export function Field({ label, icon, leading, right, className = "", ...rest }: FieldProps) {
  return (
    <label
      className={`flex items-center gap-3 rounded-2xl border border-white/25 bg-white/[0.06] px-4 py-3 focus-within:border-[#FFC400] ${className}`}
    >
      {icon && <span className="shrink-0 text-white/80">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-white/85">{label}</span>
        <span className="mt-0.5 flex items-center gap-2">
          {leading}
          <input
            {...rest}
            className="w-full min-w-0 bg-transparent text-sm text-white placeholder-white/40 outline-none disabled:opacity-60"
          />
        </span>
      </span>
      {right}
    </label>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  icon?: ReactNode;
}

export function SelectField({ label, icon, children, ...rest }: SelectFieldProps) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-white/25 bg-white/[0.06] px-4 py-3 focus-within:border-[#FFC400]">
      {icon && <span className="shrink-0 text-white/80">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-white/85">{label}</span>
        <select
          {...rest}
          className={`mt-0.5 w-full appearance-none bg-transparent text-sm outline-none [&>option]:text-black ${
            rest.value ? "text-white" : "text-white/40"
          }`}
        >
          {children}
        </select>
      </span>
      <ChevronDown size={18} className="shrink-0 text-white/70" />
    </label>
  );
}

export function PrimaryButton({
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`w-full rounded-full bg-[#FFC400] py-3.5 text-sm font-bold text-[#2a0a6b] disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function OutlineButton({
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`w-full rounded-full border border-white/70 py-3.5 text-sm font-semibold text-white disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-[#ffb4b4]">
      {children}
    </p>
  );
}