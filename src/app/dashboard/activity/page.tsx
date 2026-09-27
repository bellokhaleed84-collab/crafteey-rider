"use client";

import { useState } from "react";
import DeliveryHistoryList from "@/components/activity/DeliveryHistoryList";
import TransactionsList from "@/components/activity/TransactionsList";

const TABS = ["Deliveries", "Transactions"] as const;
type Tab = (typeof TABS)[number];

export default function ActivityPage() {
  const [tab, setTab] = useState<Tab>("Deliveries");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-brand">Activity</h1>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-2 text-xs font-semibold ${
              tab === t ? "bg-white text-brand shadow-sm" : "text-steel"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {tab === "Deliveries" ? <DeliveryHistoryList /> : <TransactionsList />}
      </div>
    </div>
  );
}