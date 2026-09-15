"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { COURIER_ACCOUNT_STATUS, REQUIRE_COURIER_APPROVAL } from "@/lib/constants";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, getIdToken } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await signIn(email, password);

      const token = await getIdToken();
      const res = await fetch("/api/couriers/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setError("Couldn't verify your account. Try again.");
        return;
      }

      const data = await res.json();

      if (!data.courier) {
        // Signed in but never finished registration — send them back to
        // complete their profile rather than dropping them somewhere
        // broken.
        router.push("/register");
        return;
      }

      if (
        !REQUIRE_COURIER_APPROVAL ||
        data.courier.status === COURIER_ACCOUNT_STATUS.APPROVED
      ) {
        router.push("/dashboard");
      } else {
        router.push("/pending");
      }
    } catch (err: any) {
      setError(err.message || "Couldn't log in. Check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-bold text-brand">Rider Log In</h1>
      <p className="mt-1 text-sm text-steel">Welcome back.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-steel">
        New here?{" "}
        <a href="/register" className="font-semibold text-brand-accent">
          Create an account
        </a>
      </p>
    </div>
  );
}