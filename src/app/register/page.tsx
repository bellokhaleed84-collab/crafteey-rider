"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  VEHICLE_TYPES,
  REQUIRE_COURIER_APPROVAL,
  type VehicleType,
} from "@/lib/constants";

export default function RegisterPage() {
  const router = useRouter();
  const { signUp, getIdToken } = useAuth();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>(VEHICLE_TYPES[0]);
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [idNumber, setIdNumber] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Step 1: create the Firebase account.
      await signUp(email, password);

      // Step 2: create the Courier profile tied to that account.
      const token = await getIdToken();
      const res = await fetch("/api/couriers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, phone, vehicleType, vehiclePlate, idNumber }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't create your courier profile.");
      }

      router.push(REQUIRE_COURIER_APPROVAL ? "/pending" : "/dashboard");
    } catch (err: any) {
      // If the Firebase account already exists, the most likely cause is a
      // half-finished signup where step 1 succeeded but step 2 failed.
      if (err?.code === "auth/email-already-in-use") {
        setError(
          "That email already has an account. Try logging in — if your profile is incomplete you'll be sent back here."
        );
      } else {
        setError(err.message || "Something went wrong. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-bold text-brand">Become a Crafteey Rider</h1>
      <p className="mt-1 text-sm text-steel">Sign up to start accepting delivery requests.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-steel">Full name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-steel">Phone number</label>
          <input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-steel">Vehicle type</label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value as VehicleType)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
          >
            {VEHICLE_TYPES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-steel">
            Vehicle plate number <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            value={vehiclePlate}
            onChange={(e) => setVehiclePlate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-steel">
            NIN / ID number <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-steel">Email</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-steel">Password</label>
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/30"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-steel">
        Already registered?{" "}
        <a href="/login" className="font-semibold text-brand-accent">
          Log in
        </a>
      </p>
    </div>
  );
}