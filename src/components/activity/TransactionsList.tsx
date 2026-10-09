"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatNaira, formatTransactionDate } from "@/lib/format";
import DetailSheet, { formatFullDate, type DetailRow } from "@/components/activity/DetailSheet";

export type TransactionType = "hub_earning" | "direct_ride_debt" | "withdrawal" | "debt_payment";

interface TxRow {
  _id: string;
  type: TransactionType;
  label: string;
  amountKobo: number;
  walletBalanceAfterKobo: number;
  debtAfterKobo: number;
  status: "completed" | "pending" | "paid" | "failed";
  createdAt: string;
}

const TYPE_META: Record<TransactionType, { verb: string; title: string; sign: "+" | "-"; color: string }> = {
  hub_earning: { verb: "credited to wallet", title: "Hub earning", sign: "+", color: "text-emerald-600" },
  direct_ride_debt: { verb: "added to debt", title: "Direct ride commission", sign: "+", color: "text-amber-600" },
  withdrawal: { verb: "withdrawn to bank", title: "Withdrawal", sign: "-", color: "text-brand" },
  debt_payment: { verb: "debt payment", title: "Debt payment", sign: "-", color: "text-emerald-600" },
};

const STATUS_BADGE: Record<TxRow["status"], string> = {
  completed: "bg-emerald-50 text-emerald-700",
  paid: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-600",
};

function explain(t: TxRow): string {
  switch (t.type) {
    case "hub_earning":
      return "Your share of a Hub delivery was added to your wallet.";
    case "direct_ride_debt":
      return "Crafteey's commission on a cash delivery was added to your debt. You already have the cash from the customer.";
    case "debt_payment":
      return "This payment reduced your debt.";
    case "withdrawal":
      if (t.status === "paid") return "This money was sent to your bank account.";
      if (t.status === "failed") return "The transfer failed and the money was returned to your wallet.";
      return "This money is on its way to your bank. It can take a little while.";
  }
}

function TransactionDetail({ t, onClose }: { t: TxRow; onClose: () => void }) {
  const meta = TYPE_META[t.type];
  const rows: DetailRow[] = [
    { label: "Type", value: meta.title },
    { label: "Date", value: formatFullDate(t.createdAt) },
    { label: "Wallet after", value: formatNaira(t.walletBalanceAfterKobo) },
    { label: "Debt after", value: formatNaira(t.debtAfterKobo) },
    { label: "Reference", value: t._id.slice(-8).toUpperCase() },
  ];

  return (
    <DetailSheet
      title={t.label}
      subtitle={meta.title}
      amountText={`${meta.sign}${formatNaira(t.amountKobo)}`}
      amountClass={meta.color}
      badgeText={t.status.charAt(0).toUpperCase() + t.status.slice(1)}
      badgeClass={STATUS_BADGE[t.status]}
      sections={[rows]}
      note={explain(t)}
      onClose={onClose}
    />
  );
}

export default function TransactionsList({
  type,
  limit = 20,
  emptyMessage = "No transactions yet.",
}: {
  type?: TransactionType;
  limit?: number;
  emptyMessage?: string;
}) {
  const { getIdToken } = useAuth();
  const [rows, setRows] = useState<TxRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TxRow | null>(null);

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      try {
        const token = await getIdToken();
        const params = new URLSearchParams({ page: String(pageNum), limit: String(limit) });
        if (type) params.set("type", type);
        const res = await fetch(`/api/couriers/transactions?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load transactions");
        setRows((prev) => (append ? [...prev, ...json.transactions] : json.transactions));
        setHasMore(json.hasMore);
        setPage(pageNum);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load transactions");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [getIdToken, limit, type]
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  if (loading) {
    return <div className="py-8 text-center text-xs text-steel">Loading...</div>;
  }

  if (error) {
    return <div className="py-8 text-center text-xs text-red-600">{error}</div>;
  }

  if (rows.length === 0) {
    return <div className="py-8 text-center text-xs text-steel">{emptyMessage}</div>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {rows.map((t) => {
        const meta = TYPE_META[t.type];
        const isTerminalStatus = t.status === "completed" || t.status === "paid";
        return (
          <button
            key={t._id}
            type="button"
            onClick={() => setSelected(t)}
            className="flex w-full items-center justify-between gap-2 py-3 text-left active:opacity-70"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-brand">{t.label}</p>
              <p className="mt-0.5 text-[11px] text-steel">
                {formatTransactionDate(t.createdAt)} {"\u00B7"} {meta.verb}
                {!isTerminalStatus ? ` ${"\u00B7"} ${t.status}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <div className="text-right">
                <p className={`text-sm font-bold ${meta.color}`}>
                  {meta.sign}
                  {formatNaira(t.amountKobo)}
                </p>
                <p className="text-[10px] text-steel">Bal: {formatNaira(t.walletBalanceAfterKobo)}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-steel" />
            </div>
          </button>
        );
      })}

      {hasMore && (
        <div className="pt-3 text-center">
          <button
            onClick={() => {
              setLoadingMore(true);
              fetchPage(page + 1, true);
            }}
            disabled={loadingMore}
            className="text-xs font-semibold text-brand-accent disabled:opacity-40"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      {selected && <TransactionDetail t={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}