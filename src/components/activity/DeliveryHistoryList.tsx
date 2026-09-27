"use client";

import { useCallback, useEffect, useState } from "react";
import { Package, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatNaira, formatTransactionDate } from "@/lib/format";

interface DeliveryRow {
  _id: string;
  pickup: string;
  dropoff: string;
  receiverName?: string;
  vehicleType: string;
  source: "hub" | "direct";
  orderNumber?: string | null;
  vendorName?: string;
  status: string;
  riderEarningKobo: number | null;
  platformCommissionKobo: number | null;
  createdAt: string;
  updatedAt: string;
}

// Matches COURIER_STATUS in lib/constants.ts exactly.
const STATUS_STYLE: Record<string, string> = {
  pending: "bg-slate-100 text-steel",
  accepted: "bg-blue-50 text-blue-600",
  picked_up: "bg-amber-50 text-amber-700",
  en_route: "bg-amber-50 text-amber-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-600",
};
const DEFAULT_STATUS_STYLE = "bg-slate-100 text-steel";

function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function DeliveryHistoryList() {
  const { getIdToken } = useAuth();
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      try {
        const token = await getIdToken();
        const params = new URLSearchParams({ page: String(pageNum), limit: "15" });
        const res = await fetch(`/api/courier-requests/history?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load delivery history");
        setRows((prev) => (append ? [...prev, ...json.requests] : json.requests));
        setHasMore(json.hasMore);
        setPage(pageNum);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load delivery history");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [getIdToken]
  );

  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  if (loading) {
    return <div className="py-8 text-center text-xs text-steel">Loading…</div>;
  }

  if (error) {
    return <div className="py-8 text-center text-xs text-red-600">{error}</div>;
  }

  if (rows.length === 0) {
    return <div className="py-8 text-center text-xs text-steel">No deliveries yet.</div>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {rows.map((r) => {
        const earning =
          r.source === "hub"
            ? r.riderEarningKobo ?? 0
            : (r.riderEarningKobo ?? 0) + (r.platformCommissionKobo ?? 0);

        return (
          <div key={r._id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 shrink-0 text-brand-accent" />
                  <p className="truncate text-sm font-semibold text-brand">
                    {r.source === "hub" ? r.vendorName || "Hub order" : "Direct delivery"}
                    {r.orderNumber ? ` · #${r.orderNumber}` : ""}
                  </p>
                </div>
                <p className="mt-1 flex items-start gap-1 text-[11px] text-steel">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {r.pickup} → {r.dropoff}
                  </span>
                </p>
                <p className="mt-1 text-[10px] text-steel">{formatTransactionDate(r.updatedAt)}</p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-brand">{formatNaira(earning)}</p>
                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    STATUS_STYLE[r.status] || DEFAULT_STATUS_STYLE
                  }`}
                >
                  {formatStatusLabel(r.status)}
                </span>
              </div>
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