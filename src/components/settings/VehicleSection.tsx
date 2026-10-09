"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CourierVehicle {
  vehicleType: string;
  vehiclePlate: string;
  idNumber: string;
}

interface Change {
  status: "pending" | "approved" | "rejected";
  vehicleType: string;
  plate: string;
  adminNote?: string;
}

const LABEL: Record<string, string> = {
  bicycle: "Bicycle",
  motorcycle: "Motorcycle",
  cargo: "Cargo",
};

const ICON: Record<string, string> = {
  bicycle: "\uD83D\uDEB2",
  motorcycle: "\uD83C\uDFCD\uFE0F",
  cargo: "\uD83D\uDE9A",
};

// Shrinks the photo on the phone so the upload stays small and quick.
function resizeToDataUrl(file: File, maxSide = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error("Couldn't read that photo."));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that photo."));
    };
    img.src = url;
  });
}

export default function VehicleSection() {
  const { getIdToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [courier, setCourier] = useState<CourierVehicle | null>(null);
  const [change, setChange] = useState<Change | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [idNumber, setIdNumber] = useState("");
  const [idSaving, setIdSaving] = useState(false);
  const [idSaved, setIdSaved] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [newType, setNewType] = useState("motorcycle");
  const [plate, setPlate] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getIdToken();
    const headers = { Authorization: `Bearer ${token}` };
    const [meRes, chRes] = await Promise.all([
      fetch("/api/couriers/me", { headers }),
      fetch("/api/couriers/vehicle-change", { headers, cache: "no-store" }),
    ]);
    const me = await meRes.json();
    if (!meRes.ok) throw new Error(me.error || "Could not load vehicle details");
    setCourier(me.courier);
    setIdNumber(me.courier.idNumber || "");
    const ch = await chRes.json().catch(() => ({}));
    setChange(chRes.ok ? ch.change ?? null : null);
  }, [getIdToken]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load vehicle details"))
      .finally(() => setLoading(false));
  }, [load]);

  async function saveId() {
    setIdSaving(true);
    setIdSaved(false);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/couriers/vehicle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ idNumber }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not save");
      setIdSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setIdSaving(false);
    }
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);
    try {
      setPhoto(await resizeToDataUrl(file));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't read that photo.");
    }
  }

  async function submitChange() {
    setFormError(null);
    if (newType === "motorcycle" && plate.trim().length < 3) {
      setFormError("Enter the plate number of your motorcycle.");
      return;
    }
    if (!photo) {
      setFormError("Add a clear photo of the vehicle.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/couriers/vehicle-change", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vehicleType: newType, plate, photoDataUrl: photo }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not send your request");
      setFormOpen(false);
      setPlate("");
      setPhoto(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not send your request");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  const pending = change?.status === "pending";
  const rejected = change?.status === "rejected";
  const vt = courier?.vehicleType ?? "";

  return (
    <div className="space-y-4">
      {/* Current vehicle */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sunshine text-3xl">
          {ICON[vt] ?? ""}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-steel">Your vehicle</p>
          <p className="text-base font-extrabold text-brand">{LABEL[vt] ?? (vt || "\u2014")}</p>
          {vt !== "bicycle" && (
            <p className="text-xs text-steel">Plate: {courier?.vehiclePlate || "\u2014"}</p>
          )}
        </div>
      </div>

      {/* Change status */}
      {pending && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-800">Waiting for approval</p>
          <p className="mt-1 text-xs text-amber-700">
            {"You asked to change to "}
            {LABEL[change!.vehicleType] ?? change!.vehicleType}
            {". You keep using your current vehicle until Crafteey approves it."}
          </p>
        </div>
      )}
      {rejected && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">Your last change was not approved</p>
          {change?.adminNote ? <p className="mt-1 text-xs text-red-600">{change.adminNote}</p> : null}
          <p className="mt-1 text-xs text-red-600">You can send a new request below.</p>
        </div>
      )}

      {/* Change vehicle */}
      {!pending && !formOpen && (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="w-full rounded-xl bg-brand-accent py-3.5 text-sm font-bold text-white active:scale-[0.98]"
        >
          Change vehicle
        </button>
      )}

      {formOpen && !pending && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-sm font-bold text-brand">New vehicle</p>
            <p className="mt-0.5 text-xs text-steel">Crafteey checks every change before it starts.</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-steel">Vehicle type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-brand"
            >
              <option value="bicycle">Bicycle</option>
              <option value="motorcycle">Motorcycle</option>
            </select>
          </div>

          {newType === "motorcycle" && (
            <div>
              <label className="text-xs font-semibold text-steel">Plate number</label>
              <input
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="e.g. ABC 123 DE"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-brand"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-steel">Photo of the vehicle</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1 flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white py-5 text-steel"
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="Vehicle preview" className="h-40 w-full object-cover" />
              ) : (
                <>
                  <Camera className="h-7 w-7" />
                  <span className="text-xs font-semibold">Tap to take or choose a photo</span>
                </>
              )}
            </button>
            {photo && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 text-xs font-semibold text-brand-accent"
              >
                Change photo
              </button>
            )}
          </div>

          {formError && <p className="text-xs text-red-600">{formError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setFormError(null);
              }}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-brand"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitChange}
              disabled={submitting}
              className="flex-1 rounded-xl bg-brand-accent py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send for approval"}
            </button>
          </div>
        </div>
      )}

      {/* ID number */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <label className="text-xs font-semibold text-steel">ID number</label>
          <input
            value={idNumber}
            onChange={(e) => {
              setIdNumber(e.target.value);
              setIdSaved(false);
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-brand"
          />
        </div>
        {idSaved && <p className="text-xs text-emerald-600">Saved.</p>}
        <button
          type="button"
          onClick={saveId}
          disabled={idSaving}
          className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-brand disabled:opacity-50"
        >
          {idSaving ? "Saving..." : "Save ID number"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}