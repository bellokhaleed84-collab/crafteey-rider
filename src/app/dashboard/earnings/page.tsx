"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Wallet, TrendingUp, Landmark, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatNaira, nextWithdrawalDate, formatWithdrawalDate } from "@/lib/format";
import EarningsChart from "@/components/earnings/EarningsChart";
import BankDetailsForm from "@/components/earnings/BankDetailsForm";

interface CourierDoc {
  debtKobo: number;
  walletBalanceKobo: number;
  lifetimeEarningsKobo: number;
  accountSuspended: boolean;
  paystackRecipientCode?: string;
  // NOTE: assumed field names for the bank-account box below — rename
  // here if your Courier schema uses different keys.
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
}

interface DailyPoint {
  date: string;
  hubEarningKobo: number;
  directRideCashKobo: number;
}

interface EarningsSummary {
  daily: DailyPoint[];
  thisMonth: {
    hubEarningKobo: number;
    directRideCashKobo: number;
    commissionKobo: number;
    hubDeliveries: number;
    directRides: number;
    totalDeliveries: number;
  };
}

const DEBT_SUSPENSION_THRESHOLD_KOBO = 800_000; // ₦8,000 — mirrors debt/pay's route constant

export default function EarningsPage() {
  const { getIdToken } = useAuth();

  const [courier, setCourier] = useState<CourierDoc | null>(null);
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [period, setPeriod] = useState<"7days" | "30days" | "all">("30days");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [withdrawing, setWithdrawing] = useState(false);
  const [payingDebt, setPayingDebt] = useState<"wallet" | "paystack" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchCourier = useCallback(async () => {
    const token = await getIdToken();
    const res = await fetch("/api/couriers/me", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not load earnings");
    if (!json.courier) throw new Error("Courier profile not found");
    setCourier(json.courier);
  }, [getIdToken]);

  const fetchSummary = useCallback(
    async (p: "7days" | "30days" | "all") => {
      const token = await getIdToken();
      const res = await fetch(`/api/couriers/earnings-summary?period=${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load earnings summary");
      setSummary(json);
    },
    [getIdToken]
  );

  // Initial load.
  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchCourier(), fetchSummary(period)])
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load earnings"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch just the chart/summary when the period toggle changes.
  useEffect(() => {
    if (loading) return; // skip on first mount, initial load already covers it
    fetchSummary(period).catch((err) =>
      setError(err instanceof Error ? err.message : "Could not load earnings summary")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  async function refreshCourier() {
    try {
      await fetchCourier();
    } catch {
      // Non-fatal — the top cards just won't refresh until next load.
    }
  }

  async function handleWithdraw() {
    setActionError(null);
    setActionMessage(null);
    setWithdrawing(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/couriers/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Withdrawal failed");
      setActionMessage(
        `Withdrawal of ${formatNaira(json.amountKobo)} ${json.status === "paid" ? "completed" : "is processing"}.`
      );
      await refreshCourier();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  }

  async function handlePayDebt(method: "wallet" | "paystack") {
    setActionError(null);
    setActionMessage(null);
    setPayingDebt(method);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/couriers/debt/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ method }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Debt payment failed");

      if (method === "wallet") {
        setActionMessage("Debt cleared from your wallet balance.");
        await refreshCourier();
      } else {
        window.location.href = json.authorizationUrl;
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Debt payment failed");
    } finally {
      setPayingDebt(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-steel" />
      </div>
    );
  }

  if (error || !courier) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-brand">Earnings</h1>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error || "Could not load your earnings"}</p>
        </div>
      </div>
    );
  }

  // Defensive against older Courier documents that predate this field
  // existing in the schema — Mongoose defaults only apply to new
  // documents, so a legacy record can come back with debtKobo undefined.
  const debtKobo = Number.isFinite(courier.debtKobo) ? courier.debtKobo : 0;
  const hasDebt = debtKobo > 0;
  const canPayFromWallet = courier.walletBalanceKobo >= debtKobo && debtKobo > 0;
  const hasBankDetails = Boolean(courier.paystackRecipientCode);
  const debtProgressPct = Math.min((debtKobo / DEBT_SUSPENSION_THRESHOLD_KOBO) * 100, 100);
  const nextWithdrawal = nextWithdrawalDate();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-brand">Earnings</h1>

      <div className="space-y-4">
        {courier.accountSuspended && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-bold text-red-700">Account suspended</p>
                <p className="mt-0.5 text-xs text-red-600">
                  Your debt is above {formatNaira(DEBT_SUSPENSION_THRESHOLD_KOBO)}. Pay it off below to go back online.
                </p>
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-emerald-600" />
                <p className="text-xs font-semibold text-steel">Wallet</p>
              </div>
              <p className="mt-1.5 text-xl font-extrabold text-brand">{formatNaira(courier.walletBalanceKobo)}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-1.5">
                <Landmark className="h-4 w-4 text-amber-600" />
                <p className="text-xs font-semibold text-steel">Debt</p>
              </div>
              <p className="mt-1.5 text-xl font-extrabold text-brand">{formatNaira(debtKobo)}</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${debtProgressPct >= 100 ? "bg-red-500" : "bg-amber-400"}`}
                  style={{ width: `${debtProgressPct}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-steel">
                {formatNaira(DEBT_SUSPENSION_THRESHOLD_KOBO)} suspension limit
              </p>
            </div>

            <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-brand-accent" />
                <p className="text-xs font-semibold text-steel">Lifetime earnings</p>
              </div>
              <p className="mt-1.5 text-xl font-extrabold text-brand">{formatNaira(courier.lifetimeEarningsKobo)}</p>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-brand">Earnings over time</p>
              <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
                {(["7days", "30days", "all"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                      period === p ? "bg-white text-brand shadow-sm" : "text-steel"
                    }`}
                  >
                    {p === "7days" ? "7d" : p === "30days" ? "30d" : "All"}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              {summary ? (
                <EarningsChart data={summary.daily} />
              ) : (
                <Loader2 className="mx-auto h-4 w-4 animate-spin text-steel" />
              )}
            </div>
          </div>

          {/* This month summary */}
          {summary && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-bold text-brand">This month</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-steel">Hub earnings</p>
                  <p className="font-bold text-brand">{formatNaira(summary.thisMonth.hubEarningKobo)}</p>
                </div>
                <div>
                  <p className="text-steel">Direct-ride cash</p>
                  <p className="font-bold text-brand">{formatNaira(summary.thisMonth.directRideCashKobo)}</p>
                </div>
                <div>
                  <p className="text-steel">Platform commission</p>
                  <p className="font-bold text-brand">{formatNaira(summary.thisMonth.commissionKobo)}</p>
                </div>
                <div>
                  <p className="text-steel">Deliveries</p>
                  <p className="font-bold text-brand">
                    {summary.thisMonth.totalDeliveries}{" "}
                    <span className="font-normal text-steel">
                      ({summary.thisMonth.hubDeliveries} hub · {summary.thisMonth.directRides} direct)
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Next withdrawal + bank account */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-steel">Next withdrawal</p>
              <p className="mt-1 text-sm font-bold text-brand">{formatWithdrawalDate(nextWithdrawal)}</p>
              <p className="mt-1 text-[11px] text-steel">Payouts run every Monday &amp; Thursday.</p>
              <button
                onClick={handleWithdraw}
                disabled={!hasBankDetails || courier.walletBalanceKobo <= 0 || courier.accountSuspended || withdrawing}
                className="mt-3 w-full rounded-xl bg-brand py-2.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {withdrawing ? "Withdrawing…" : "Withdraw now"}
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold text-steel">Bank account</p>
              <BankDetailsForm onSaved={refreshCourier} />
            </div>
          </div>

          {/* Debt payment */}
          {hasDebt && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-amber-700" />
                <p className="text-sm font-bold text-amber-800">Pay off your debt</p>
              </div>
              <p className="mt-1 text-xs text-amber-700">
                From direct-booking commissions. Pay this off to keep accepting work.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => handlePayDebt("wallet")}
                  disabled={!canPayFromWallet || payingDebt !== null}
                  className="flex-1 rounded-xl border border-amber-300 bg-white py-2.5 text-xs font-semibold text-amber-800 disabled:opacity-40"
                >
                  {payingDebt === "wallet" ? "Paying…" : "Pay from wallet"}
                </button>
                <button
                  onClick={() => handlePayDebt("paystack")}
                  disabled={payingDebt !== null}
                  className="flex-1 rounded-xl bg-amber-600 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {payingDebt === "paystack" ? "Redirecting…" : "Pay with card"}
                </button>
              </div>
              {!canPayFromWallet && courier.walletBalanceKobo > 0 && (
                <p className="mt-2 text-[11px] text-amber-700">Wallet balance isn't enough to cover this debt yet.</p>
              )}
            </div>
          )}

          {(actionMessage || actionError) && (
            <p
              className={`rounded-2xl p-4 text-center text-xs ${
                actionError ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {actionError || actionMessage}
            </p>
          )}
      </div>
    </div>
  );
}