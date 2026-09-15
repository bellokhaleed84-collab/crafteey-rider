"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { SETTINGS_SECTIONS } from "@/lib/settingsSections";

export default function SettingsPage() {
  const router = useRouter();
  const { signOut } = useAuth();

  const core = SETTINGS_SECTIONS.filter((s) => s.core);
  const more = SETTINGS_SECTIONS.filter((s) => !s.core);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-brand">Settings</h1>

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
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          More settings
        </p>
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