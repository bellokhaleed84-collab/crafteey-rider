"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SETTINGS_SECTIONS } from "@/lib/settingsSections";

type Extra = { slug: string; title: string; description: string; icon: string; group: "core" | "more" };

export default function SettingsPage() {
  const router = useRouter();
  const { signOut, getIdToken } = useAuth();

  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [extras, setExtras] = useState<Extra[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch("/api/couriers/me", { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (res.ok && json.courier) {
          setName(json.courier.name);
          setPhone(json.courier.phone);
        }
      } catch {
        // Non-fatal - the card just falls back to a generic label below.
      }
    })();
  }, [getIdToken]);

  // Extra sections the admin added. If this fails, the built-in list still shows.
  useEffect(() => {
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch("/api/rider-content/sections", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(json.sections)) setExtras(json.sections);
      } catch {
        // Non-fatal.
      }
    })();
  }, [getIdToken]);

  const core = SETTINGS_SECTIONS.filter((s) => s.core);
  // Profile is pulled out of the "more" list since it's featured above.
  const more = SETTINGS_SECTIONS.filter((s) => !s.core && s.slug !== "profile");
  const extraCore = extras.filter((e) => e.group === "core");
  const extraMore = extras.filter((e) => e.group !== "core");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-brand">Settings</h1>

      <Link
        href="/dashboard/settings/profile"
        className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <User className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-brand">{name || "Your profile"}</p>
          <p className="mt-0.5 text-xs text-steel">{phone || "View and edit your details"}</p>
        </div>
        <span className="ml-auto text-steel">{"\u2192"}</span>
      </Link>

      <div className="space-y-2">
        {core.map((s) => (
          <Link
            key={s.slug}
            href={`/dashboard/settings/${s.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <span className="text-xl">{s.icon}</span>
            <div>
              <p className="text-sm font-semibold text-brand">{s.label}</p>
              <p className="text-xs text-steel">{s.description}</p>
            </div>
          </Link>
        ))}
        {extraCore.map((s) => (
          <Link
            key={s.slug}
            href={`/dashboard/settings/${s.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <span className="text-xl">{s.icon}</span>
            <div>
              <p className="text-sm font-semibold text-brand">{s.title}</p>
              {s.description && <p className="text-xs text-steel">{s.description}</p>}
            </div>
          </Link>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">More settings</p>
        <div className="space-y-2">
          {more.map((s) => (
            <Link
              key={s.slug}
              href={`/dashboard/settings/${s.slug}`}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
            >
              <span className="text-lg">{s.icon}</span>
              <p className="text-sm font-medium text-brand">{s.label}</p>
            </Link>
          ))}
          {extraMore.map((s) => (
            <Link
              key={s.slug}
              href={`/dashboard/settings/${s.slug}`}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
            >
              <span className="text-lg">{s.icon}</span>
              <p className="text-sm font-medium text-brand">{s.title}</p>
            </Link>
          ))}
        </div>
      </div>

      <button
        onClick={async () => {
          await signOut();
          router.replace("/login");
        }}
        className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-red-600"
      >
        Log out
      </button>
    </div>
  );
}