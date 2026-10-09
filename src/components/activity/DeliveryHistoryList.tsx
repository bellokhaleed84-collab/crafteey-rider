"use client";

import { useCallback, useEffect, useState } from "react";
import { Package, MapPin, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatNaira, formatTransactionDate } from "@/lib/format";
import DetailSheet, { formatFullDate, type DetailRow } from "@/components/activity/DetailSheet";

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

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function DeliveryDetail({ r, onClose }: { r: DeliveryRow; onClose: () => void }) {
  const isHub = r.source === "hub";
  const earning = r.riderEarningKobo;
  const commission = r.platformCommissionKobo;
  const hasMoney = typeof earning === "number";
  const total = hasMoney ? earning + (commission ?? 0) : null;
  const delivered = r.status === "delivered";

  const about: DetailRow[] = [
    { label: "Type", value: isHub ? "Hub order" : "Direct delivery" },
  ];
  if (isHub && r.vendorName) about.push({ label: "Vendor", value: r.vendorName });
  if (r.orderNumber) about.push({ label: "Order number", value: `#${r.orderNumber}` });
  about.push({ label: "Vehicle", value: cap(r.vehicleType) });
  if (r.receiverName) about.push({ label: "Receiver", value: r.receiverName });
  about.push({ label: "Started", value: formatFullDate(r.createdAt) });
  about.push({ label: delivered ? "Delivered" : "Last update", value: formatFullDate(r.updatedAt) });

  const trip: DetailRow[] = [
    { label: "Pickup", value: r.pickup },
    { label: "Drop-off", value: r.dropoff },
  ];

  const money: DetailRow[] = [];
  if (hasMoney) {
    if (total !== null && commission !== null && commission !== undefined) {
      money.push({ label: isHub ? "Delivery fee" : "Cash collected", value: formatNaira(total) });
    }
    money.push({ label: "Your earnings", value: formatNaira(earning as number) });
    if (typeof commission === "number") {
      money.push({
        label: isHub ? "Crafteey commission" : "Commission (added to debt)",
        value: formatNaira(commission),
      });
    }
  }

  let note: string | undefined;
  if (!delivered) {
    note = "Earnings are added when the delivery is completed.";
  } else if (isHub) {
    note = "The customer paid in the app. Your earnings were added to your wallet.";
  } else {
    note = "You collected the fare in cash from the customer. Crafteey's commission was added to your debt.";
  }

  return (
    <DetailSheet
      title={isHub ? r.vendorName || "Hub order" : "Direct delivery"}
      subtitle={r.orderNumber ? `Order #${r.orderNumber}` : undefined}
      amountText={hasMoney ? formatNaira(earning as number) : undefined}
      badgeText={formatStatusLabel(r.status)}
      badgeClass={STATUS_STYLE[r.status] || DEFAULT_STATUS_STYLE}
      sections={[trip, about, money]}
      note={note}
      onClose={onClose}
    />
  );
}

export default function DeliveryHistoryList() {
  const { getIdToken } = useAuth();
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DeliveryRow | null>(null);

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
    return <div className="py-8 text-center text-xs text-steel">Loading...</div>;
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
          <button
            key={r._id}
            type="button"
            onClick={() => setSelected(r)}
            className="block w-full py-3 text-left active:opacity-70"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 shrink-0 text-brand-accent" />
                  <p className="truncate text-sm font-semibold text-brand">
                    {r.source === "hub" ? r.vendorName || "Hub order" : "Direct delivery"}
                    {r.orderNumber ? ` ${"\u00B7"} #${r.orderNumber}` : ""}
                  </p>
                </div>
                <p className="mt-1 flex items-start gap-1 text-[11px] text-steel">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {r.pickup} {"\u2192"} {r.dropoff}
                  </span>
                </p>
                <p className="mt-1 text-[10px] text-steel">{formatTransactionDate(r.updatedAt)}</p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <div className="text-right">
                  <p className="text-sm font-bold text-brand">{formatNaira(earning)}</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      STATUS_STYLE[r.status] || DEFAULT_STATUS_STYLE
                    }`}
                  >
                    {formatStatusLabel(r.status)}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-steel" />
              </div>
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

      {selected && <DeliveryDetail r={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}