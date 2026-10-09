"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import { AVATARS } from "@/lib/avatars";
import { formatNaira } from "@/lib/format";

interface CourierProfile {
  name: string;
  phone: string;
  status: string;
  avatarId?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  idNumber?: string;
  accountName?: string;
  accountNumber?: string;
  lifetimeEarningsKobo?: number;
  createdAt?: string;
}

const VEHICLE_LABEL: Record<string, string> = {
  bicycle: "Bicycle",
  motorcycle: "Motorcycle",
  cargo: "Cargo",
};

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Shows only the last 3 characters of a private number.
function mask(s?: string): string {
  if (!s) return "\u2014";
  if (s.length <= 4) return "\u2022\u2022\u2022\u2022";
  return "\u2022\u2022\u2022\u2022" + s.slice(-3);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <p className="shrink-0 text-xs text-steel">{label}</p>
      <p className="min-w-0 break-words text-right text-sm font-semibold text-brand">{value || "\u2014"}</p>
    </div>
  );
}

export default function ProfileSection() {
  const { getIdToken, user } = useAuth();
  const [courier, setCourier] = useState<CourierProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const token = await getIdToken();
    const res = await fetch("/api/couriers/me", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not load profile");
    if (!json.courier) throw new Error("Profile not found");
    setCourier(json.courier);
    setName(json.courier.name);
    setPhone(json.courier.phone);
    setAvatarId(json.courier.avatarId || "");
  }, [getIdToken]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load profile"))
      .finally(() => setLoading(false));
  }, [load]);

  async function pickAvatar(id: string) {
    if (id === avatarId || savingAvatar) return;
    const previous = avatarId;
    setAvatarId(id);
    setAvatarError(null);
    setSavingAvatar(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/couriers/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarId: id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not save your avatar");
    } catch (err) {
      setAvatarId(previous);
      setAvatarError(err instanceof Error ? err.message : "Could not save your avatar");
    } finally {
      setSavingAvatar(false);
    }
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/couriers/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, phone }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not save changes");
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (!courier) {
    return (
      <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-600">
        {error || "Could not load your profile"}
      </p>
    );
  }

  const joined = courier.createdAt
    ? new Date(courier.createdAt).toLocaleDateString("en-NG", { month: "long", year: "numeric" })
    : "";
  const vt = courier.vehicleType ?? "";

  return (
    <div className="space-y-4">
      {/* Big avatar + name */}
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-5 text-center">
        <Avatar avatarId={avatarId} className="h-24 w-24" />
        <p className="mt-3 text-lg font-extrabold text-brand">{courier.name}</p>
        <p className="mt-0.5 text-xs text-steel">{courier.phone}</p>
        {courier.status && (
          <span className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-steel">
            {cap(courier.status)}
          </span>
        )}
      </div>

      {/* Avatar picker */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-brand">Choose your avatar</p>
        <p className="mt-0.5 text-xs text-steel">Tap one. It saves right away.</p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {AVATARS.map((a) => {
            const on = a.id === avatarId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => pickAvatar(a.id)}
                aria-label={`Avatar ${a.id.replace("a", "")}`}
                aria-pressed={on}
                className={`relative aspect-square rounded-full p-0.5 active:scale-95 ${
                  on ? "ring-4 ring-brand-accent" : "ring-1 ring-slate-200"
                }`}
              >
                <Avatar avatarId={a.id} className="h-full w-full" />
                {on && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-accent text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {avatarError && <p className="mt-3 text-xs text-red-600">{avatarError}</p>}
      </div>

      {/* Editable details */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-bold text-brand">Your details</p>
        <div>
          <label className="text-xs font-semibold text-steel">Full name</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-brand"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-steel">Phone number</label>
          <input
            value={phone}
            inputMode="tel"
            onChange={(e) => {
              setPhone(e.target.value);
              setSaved(false);
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-brand"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {saved && <p className="text-xs text-emerald-600">Saved.</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-brand py-3.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      {/* Read-only account info */}
      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4">
        <InfoRow label="Email" value={user?.email ?? ""} />
        <InfoRow label="Account status" value={cap(courier.status)} />
        <InfoRow label="Member since" value={joined} />
        <InfoRow label="Lifetime earnings" value={formatNaira(courier.lifetimeEarningsKobo ?? 0)} />
      </div>

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4">
        <InfoRow label="Vehicle" value={VEHICLE_LABEL[vt] ?? cap(vt)} />
        {vt !== "bicycle" && <InfoRow label="Plate number" value={courier.vehiclePlate ?? ""} />}
        <InfoRow label="ID number" value={mask(courier.idNumber)} />
      </div>

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4">
        <InfoRow label="Bank account name" value={courier.accountName ?? ""} />
        <InfoRow label="Account number" value={mask(courier.accountNumber)} />
      </div>

      <p className="text-center text-[11px] text-steel">
        To change your vehicle or bank account, use Vehicle details or Earnings &amp; payments in Settings.
      </p>
    </div>
  );
}