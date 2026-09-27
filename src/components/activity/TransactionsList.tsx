"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { formatNaira, formatTransactionDate } from "@/lib/format";

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

const TYPE_META: Record<TransactionType, { verb: string; sign: "+" | "-"; color: string }> = {
  hub_earning: { verb: "credited to wallet", sign: "+", color: "text-emerald-600" },
  direct_ride_debt: { verb: "added to debt", sign: "+", color: "text-amber-600" },
  withdrawal: { verb: "withdrawn to bank", sign: "-", color: "text-brand" },
  debt_payment: { verb: "debt payment", sign: "-", color: "text-emerald-600" },
};

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
    // Re-fetch from page 1 whenever the type filter changes (tab switch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  if (loading) {
    return <div className="py-8 text-center text-xs text-steel">Loading…</div>;
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
          <div key={t._id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-brand">{t.label}</p>
              <p className="mt-0.5 text-[11px] text-steel">
                {formatTransactionDate(t.createdAt)} · {meta.verb}
                {!isTerminalStatus ? ` · ${t.status}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${meta.color}`}>
                {meta.sign}
                {formatNaira(t.amountKobo)}
              </p>
              <p className="text-[10px] text-steel">Bal: {formatNaira(t.walletBalanceAfterKobo)}</p>
            </div>
          </div>
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
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}