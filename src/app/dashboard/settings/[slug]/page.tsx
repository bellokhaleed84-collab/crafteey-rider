"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getSettingsSection } from "@/lib/settingsSections";
import { getPreferGoogleMaps, setPreferGoogleMaps } from "@/lib/navigation";

export default function SettingsSectionPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const section = getSettingsSection(slug);

  return (
    <div className="space-y-4">
      <Link href="/dashboard/settings" className="text-sm font-semibold text-steel">
        ← Settings
      </Link>
      <h1 className="text-lg font-bold text-brand">{section?.label ?? "Settings"}</h1>

      {slug === "navigation" && <NavigationSettings />}
      {slug === "profile" && <ProfileSettings />}
      {slug !== "navigation" && slug !== "profile" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-steel">
            {section?.description ?? "This section is coming soon."}
          </p>
          <p className="mt-1 text-xs text-slate-400">Coming soon.</p>
        </div>
      )}
    </div>
  );
}

function NavigationSettings() {
  const [preferGoogle, setPreferGoogle] = useState(false);

  useEffect(() => {
    setPreferGoogle(getPreferGoogleMaps());
  }, []);

  function toggle() {
    const next = !preferGoogle;
    setPreferGoogle(next);
    setPreferGoogleMaps(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
        <div className="pr-4">
          <p className="text-sm font-semibold text-brand">Always use Google Maps</p>
          <p className="mt-1 text-xs text-steel">
            Skip the in-app map and open Google Maps for every pickup and drop-off.
          </p>
        </div>
        <button
          onClick={toggle}
          aria-pressed={preferGoogle}
          className={`h-7 w-12 shrink-0 rounded-full transition-colors ${
            preferGoogle ? "bg-brand-accent" : "bg-slate-300"
          }`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              preferGoogle ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-brand">Automatic fallback</p>
        <p className="mt-1 text-xs text-steel">
          If the in-app map ever fails to load, you'll automatically see an
          "Open in Google Maps" button instead — even with this toggle off.
        </p>
      </div>
    </div>
  );
}

function ProfileSettings() {
  const { getIdToken } = useAuth();
  const [courier, setCourier] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch("/api/couriers/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCourier(data.courier);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="text-sm text-steel">Loading…</p>;
  if (!courier) return <p className="text-sm text-steel">Couldn't load your profile.</p>;

  const fields: [string, string][] = [
    ["Name", courier.name],
    ["Phone", courier.phone],
    ["Vehicle type", courier.vehicleType],
    ["Vehicle plate", courier.vehiclePlate || "—"],
    ["ID number", courier.idNumber || "—"],
    ["Approval status", courier.status],
  ];

  return (
    <div className="space-y-2">
      {fields.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-400">{label}</p>
          <p className="text-sm font-semibold text-brand">{value}</p>
        </div>
      ))}
      <p className="text-xs text-slate-400">Editing your profile is coming soon.</p>
    </div>
  );
}