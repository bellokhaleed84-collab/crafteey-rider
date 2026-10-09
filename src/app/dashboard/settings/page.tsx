"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SETTINGS_MENU } from "@/lib/settingsMenu";
import Avatar from "@/components/Avatar";

type Extra = { slug: string; title: string; description: string; icon: string; group: "core" | "more" };

function Row({ href, icon, label, description }: { href: string; icon: ReactNode; label: string; description?: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[60px] items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0 active:bg-slate-50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-brand">{label}</span>
        {description ? <span className="block truncate text-xs text-steel">{description}</span> : null}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-steel" />
    </Link>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { signOut, getIdToken } = useAuth();

  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<string>("");
  const [profileLoaded, setProfileLoaded] = useState(false);
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
          setAvatarId(json.courier.avatarId || "");
        }
      } catch {
        // Non-fatal - the card falls back to a generic label.
      } finally {
        setProfileLoaded(true);
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

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-brand">Settings</h1>

      {/* Profile card */}
      {profileLoaded ? (
        <Link
          href="/dashboard/settings/profile"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <Avatar avatarId={avatarId} className="h-14 w-14" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-brand">{name || "Your profile"}</p>
            <p className="mt-0.5 truncate text-xs text-steel">{phone || "View and edit your details"}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-steel" />
        </Link>
      ) : (
        <div className="h-[88px] animate-pulse rounded-2xl bg-slate-200" />
      )}

      {SETTINGS_MENU.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.title}</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {group.items.map((s) => (
              <Row key={s.slug} href={`/dashboard/settings/${s.slug}`} icon={s.icon} label={s.label} description={s.description} />
            ))}
            {group.title === "App" &&
              extras.map((s) => (
                <Row
                  key={s.slug}
                  href={`/dashboard/settings/${s.slug}`}
                  icon={s.icon}
                  label={s.title}
                  description={s.description}
                />
              ))}
          </div>
        </div>
      ))}

      <button
        onClick={async () => {
          await signOut();
          router.replace("/login");
        }}
        className="w-full rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-red-600"
      >
        Log out
      </button>
    </div>
  );
}