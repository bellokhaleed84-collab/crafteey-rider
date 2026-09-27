"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Bank {
  name: string;
  code: string;
}

interface BankDetails {
  hasBankDetails: boolean;
  bankCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
}

export default function BankDetailsForm({ onSaved }: { onSaved?: () => void }) {
  const { getIdToken } = useAuth();

  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);

  const [details, setDetails] = useState<BankDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedName, setResolvedName] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    const token = await getIdToken();
    const res = await fetch("/api/couriers/bank-details", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not load bank details");
    setDetails(json);
    if (json.bankCode) setBankCode(json.bankCode);
    if (json.accountNumber) setAccountNumber(json.accountNumber);
    return json as BankDetails;
  }, [getIdToken]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch("/api/couriers/banks", { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load bank list");
        setBanks(json.banks);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load bank list");
      } finally {
        setBanksLoading(false);
      }
    })();

    loadDetails()
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load bank details"))
      .finally(() => setDetailsLoading(false));
  }, [getIdToken, loadDetails]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResolvedName(null);

    if (!bankCode || accountNumber.length !== 10) {
      setError("Select a bank and enter a valid 10-digit account number.");
      return;
    }

    setSaving(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/couriers/bank-details", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bankCode, accountNumber }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not verify bank details");

      setResolvedName(json.accountName);
      await loadDetails();
      setEditing(false);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify bank details");
    } finally {
      setSaving(false);
    }
  }

  if (detailsLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-steel" />;
  }

  const bankName = banks.find((b) => b.code === details?.bankCode)?.name;

  if (details?.hasBankDetails && !editing) {
    return (
      <div>
        <p className="text-sm font-bold text-brand">{details.accountName}</p>
        <p className="mt-0.5 text-[11px] text-steel">
          {bankName || details.bankCode} · ····{details.accountNumber?.slice(-4)}
        </p>
        <button onClick={() => setEditing(true)} className="mt-2 text-[11px] font-semibold text-brand-accent">
          Change bank account
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      <select
        value={bankCode}
        onChange={(e) => setBankCode(e.target.value)}
        disabled={banksLoading}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-brand"
      >
        <option value="">{banksLoading ? "Loading banks…" : "Select your bank"}</option>
        {banks.map((b) => (
          <option key={b.code} value={b.code}>
            {b.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        inputMode="numeric"
        maxLength={10}
        placeholder="10-digit account number"
        value={accountNumber}
        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-brand"
      />

      {error && <p className="text-[11px] text-red-600">{error}</p>}
      {resolvedName && <p className="text-[11px] text-emerald-600">Verified: {resolvedName}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-brand py-2.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Verifying…" : "Verify & save"}
        </button>
        {details?.hasBankDetails && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-steel"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}