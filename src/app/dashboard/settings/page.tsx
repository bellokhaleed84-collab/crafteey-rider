"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsPage() {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-brand">Settings</h1>
      <button
        onClick={async () => {
          await signOut();
          router.replace("/login");
        }}
        className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-red-600"
      >
        Log out
      </button>
    </div>
  );
}