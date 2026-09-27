"use client";

import Link from "next/link";
import BankDetailsForm from "@/components/earnings/BankDetailsForm";

export default function PaymentsSection() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-sm font-bold text-brand">Payout bank account</p>
        <BankDetailsForm />
      </div>

      <Link
        href="/dashboard/earnings"
        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-brand"
      >
        View earnings & withdrawals <span>→</span>
      </Link>
    </div>
  );
}