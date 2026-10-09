"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShell, BrandLockup, OutlineButton } from "@/components/auth/AuthUI";

export default function PendingPage() {
  const router = useRouter();
  const { signOut } = useAuth();

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <AuthShell>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <BrandLockup markWidth={52} />
        <div className="mt-8 rounded-2xl border border-white/20 bg-white/[0.08] p-6">
          <h1 className="text-lg font-bold">Application under review</h1>
          <p className="mt-2 text-sm text-white/80">
            Thanks for signing up. We&apos;re verifying your details. This usually doesn&apos;t take
            long. You&apos;ll be able to log in and start accepting requests once you&apos;re
            approved.
          </p>
        </div>
      </div>
      <OutlineButton onClick={handleLogout}>Log out</OutlineButton>
    </AuthShell>
  );
}