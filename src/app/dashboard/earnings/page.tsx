"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, Wallet, TrendingUp, Landmark, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CourierDoc {
  debtKobo: number;
  walletBalanceKobo: number;
  lifetimeEarningsKobo: number;
  accountSuspended: boolean;
  paystackRecipientCode?: string;
}

const DEBT_SUSPENSION_THRESHOLD_KOBO = 800_000; // ₦8,000 — mirrors debt/pay's route constant

function formatNaira(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString()}`;
}

function isWithdrawalDayToday(): boolean {
  const day = new Date().getDay();
  return day === 1 || day === 4; // Monday or Thursday
}

export default function EarningsPage() {
  const { getIdToken } = useAuth();

  const [courier, setCourier] = useState<CourierDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [withdrawing, setWithdrawing] = useState(false);
  const [payingDebt, setPayingDebt] = useState<"wallet" | "paystack" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/couriers/me", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load earnings");
      if (!json.courier) throw new Error("Courier profile not found");
      setCourier(json.courier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load earnings");
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

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
      await fetchSnapshot();
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
        await fetchSnapshot();
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

  const hasDebt = courier.debtKobo > 0;
  const canPayFromWallet = courier.walletBalanceKobo >= courier.debtKobo && courier.debtKobo > 0;
  const hasBankDetails = Boolean(courier.paystackRecipientCode);
  const withdrawalDay = isWithdrawalDayToday();
  const canWithdraw = courier.walletBalanceKobo > 0 && withdrawalDay && hasBankDetails && !courier.accountSuspended;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-brand">Earnings</h1>

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

      {/* Wallet balance */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-emerald-600" />
          <p className="text-sm font-bold text-brand">Wallet balance</p>
        </div>
        <p className="mt-2 text-3xl font-extrabold text-brand">{formatNaira(courier.walletBalanceKobo)}</p>
        <p className="mt-1 text-xs text-steel">From Hub deliveries — paid out Mondays &amp; Thursdays.</p>

        {!hasBankDetails && (
          <p className="mt-3 text-xs font-semibold text-amber-600">Add your bank details to enable withdrawals.</p>
        )}
        {hasBankDetails && !withdrawalDay && (
          <p className="mt-3 text-xs text-steel">Withdrawals open again on the next Monday or Thursday.</p>
        )}

        <button
          onClick={handleWithdraw}
          disabled={!canWithdraw || withdrawing}
          className="mt-4 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {withdrawing ? "Withdrawing…" : "Withdraw"}
        </button>
      </div>

      {/* Debt */}
      {hasDebt && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-amber-700" />
            <p className="text-sm font-bold text-amber-800">Outstanding debt</p>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-amber-800">{formatNaira(courier.debtKobo)}</p>
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

      {/* Lifetime earnings */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-brand-accent" />
          <p className="text-sm font-bold text-brand">Lifetime earnings</p>
        </div>
        <p className="mt-2 text-2xl font-extrabold text-brand">{formatNaira(courier.lifetimeEarningsKobo)}</p>
        <p className="mt-1 text-xs text-steel">Total earned from Hub deliveries, all-time.</p>
      </div>

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
  );
}