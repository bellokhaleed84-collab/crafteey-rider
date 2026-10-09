"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Lock, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { COURIER_ACCOUNT_STATUS, REQUIRE_COURIER_APPROVAL } from "@/lib/constants";
import {
  AuthShell,
  BrandLockup,
  ErrorText,
  Field,
  OutlineButton,
  PrimaryButton,
} from "@/components/auth/AuthUI";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signInWithToken, resetPassword, getIdToken } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    if (!welcome) return;
    const t = setTimeout(() => router.replace("/dashboard"), 1600);
    return () => clearTimeout(t);
  }, [welcome, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    try {
      const id = identifier.trim();

      if (id.includes("@")) {
        await signIn(id, password);
      } else {
        const loginRes = await fetch("/api/couriers/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: id, password }),
        });
        const loginData = await loginRes.json().catch(() => ({}));
        if (!loginRes.ok || !loginData.token) {
          throw new Error(loginData.error || "Wrong phone number or password.");
        }
        await signInWithToken(loginData.token);
      }

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
        // Signed in but never finished registration - send them back to
        // complete their profile.
        router.push("/register");
        return;
      }

      if (
        !REQUIRE_COURIER_APPROVAL ||
        data.courier.status === COURIER_ACCOUNT_STATUS.APPROVED
      ) {
        setWelcome(true);
      } else {
        router.push("/pending");
      }
    } catch (err: any) {
      const code = err?.code as string | undefined;
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found" ||
        code === "auth/invalid-email"
      ) {
        setError("Wrong email or password.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many tries. Wait a few minutes and try again.");
      } else {
        setError(err?.message || "Couldn't log in. Check your details and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot() {
    setError(null);
    setInfo(null);
    const id = identifier.trim();
    if (!id.includes("@")) {
      setError("Type your email address above, then tap Forgot Password.");
      return;
    }
    try {
      await resetPassword(id);
      setInfo("Password reset link sent. Check your email.");
    } catch {
      setError("Couldn't send the reset email. Check the address and try again.");
    }
  }

  if (welcome) {
    return (
      <AuthShell>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <BrandLockup markWidth={52} />
          <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-[#16a34a]">
            <Check size={30} strokeWidth={3} className="text-white" />
          </div>
          <h1 className="mt-5 text-2xl font-bold">Welcome Back!</h1>
          <p className="mt-2 text-sm text-white/80">You&apos;re all set. Let&apos;s get you delivering.</p>
        </div>
        <PrimaryButton onClick={() => router.replace("/dashboard")}>Go to Dashboard</PrimaryButton>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="flex flex-1 flex-col">
        <div className="pt-4">
          <BrandLockup markWidth={48} />
        </div>

        <h1 className="mt-8 text-2xl font-bold">Welcome Back</h1>
        <p className="mt-1 text-sm text-white/80">Log in to your Crafteey Riders account.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
          <Field
            label="Phone Number or Email"
            icon={<Phone size={20} />}
            placeholder="Enter your phone number or email"
            autoComplete="username"
            autoCapitalize="none"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <Field
            label="Password"
            icon={<Lock size={20} />}
            placeholder="Enter your password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            right={
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="shrink-0 text-white/80"
              >
                {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            }
          />

          <div className="text-right">
            <button
              type="button"
              onClick={handleForgot}
              className="text-xs font-semibold text-[#FFC400]"
            >
              Forgot Password?
            </button>
          </div>

          <ErrorText>{error}</ErrorText>
          {info && <p className="text-sm text-[#b9f6ca]">{info}</p>}

          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? "Logging in\u2026" : "Log In"}
          </PrimaryButton>
        </form>

        <div className="mt-auto space-y-3 pt-8">
          <p className="text-center text-xs text-white/70">OR</p>
          <OutlineButton onClick={() => router.push("/register")}>Create a New Account</OutlineButton>
          <p className="pt-2 text-center text-xs text-white/70">Safe. Fast. Reliable.</p>
        </div>
      </div>
    </AuthShell>
  );
}