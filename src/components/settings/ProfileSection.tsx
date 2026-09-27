"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CourierProfile {
  name: string;
  phone: string;
  status: string;
}

export default function ProfileSection() {
  const { getIdToken } = useAuth();
  const [courier, setCourier] = useState<CourierProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const token = await getIdToken();
    const res = await fetch("/api/couriers/me", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not load profile");
    setCourier(json.courier);
    setName(json.courier.name);
    setPhone(json.courier.phone);
  }, [getIdToken]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load profile"))
      .finally(() => setLoading(false));
  }, [load]);

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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save changes");
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-steel" />;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <label className="text-xs font-semibold text-steel">Full name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-brand"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-steel">Phone number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-brand"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {saved && <p className="text-xs text-emerald-600">Saved.</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {courier?.status && (
        <p className="text-[11px] text-steel">
          Account status: <span className="font-semibold">{courier.status}</span>
        </p>
      )}
    </div>
  );
}