"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CourierVehicle {
  vehicleType: string;
  vehiclePlate: string;
  idNumber: string;
  idPhotoUrl: string;
}

const VEHICLE_LABEL: Record<string, string> = {
  bicycle: "Bicycle",
  motorcycle: "Motorcycle",
  cargo: "Cargo",
};

export default function VehicleSection() {
  const { getIdToken } = useAuth();
  const [courier, setCourier] = useState<CourierVehicle | null>(null);
  const [plate, setPlate] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const token = await getIdToken();
    const res = await fetch("/api/couriers/me", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not load vehicle details");
    setCourier(json.courier);
    setPlate(json.courier.vehiclePlate || "");
    setIdNumber(json.courier.idNumber || "");
  }, [getIdToken]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load vehicle details"))
      .finally(() => setLoading(false));
  }, [load]);

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/couriers/vehicle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vehiclePlate: plate, idNumber }),
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
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold text-steel">Vehicle type</p>
        <p className="mt-1 text-sm font-bold text-brand">
          {courier ? VEHICLE_LABEL[courier.vehicleType] ?? courier.vehicleType : "—"}
        </p>
        <p className="mt-1 text-[11px] text-steel">Contact support to change your registered vehicle type.</p>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <label className="text-xs font-semibold text-steel">Plate number</label>
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-brand"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-steel">ID number</label>
          <input
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-brand"
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

      <p className="text-[11px] text-steel">
        ID photo re-upload isn't wired up — that needs a file-storage integration (e.g. Firebase Storage). Say the
        word if you want that built next.
      </p>
    </div>
  );
}