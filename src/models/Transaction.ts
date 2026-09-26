import { Schema, models, model } from "mongoose";

// One row per balance-changing event — the ledger that powers the
// Recent Transactions list, the Transactions/Debt History/Withdrawals
// tabs, and the earnings chart. Written ALONGSIDE the existing running
// totals on Courier (walletBalanceKobo/debtKobo/lifetimeEarningsKobo) —
// those stay the fast source of truth for the top summary cards; this
// is the detailed history behind them.
export const TRANSACTION_TYPE = {
  HUB_EARNING: "hub_earning", // rider's 80% credited to wallet on a Hub delivery
  DIRECT_RIDE_DEBT: "direct_ride_debt", // platform's 20% added to debt on a direct booking
  WITHDRAWAL: "withdrawal", // wallet -> bank payout
  DEBT_PAYMENT: "debt_payment", // debt cleared, via wallet or Paystack card
} as const;

export type TransactionType = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

const TransactionSchema = new Schema(
  {
    courierUid: { type: String, required: true, index: true },
    type: { type: String, enum: Object.values(TRANSACTION_TYPE), required: true, index: true },

    // Always positive — the type + sign convention (wallet credit vs.
    // debit, debt increase vs. decrease) is implied by `type`, not stored
    // as a signed number, so a UI never has to guess which way it moved.
    amountKobo: { type: Number, required: true },

    // Wallet or debt balance immediately after this event — lets the
    // UI show "Balance: ₦3,434" per row without recomputing history.
    walletBalanceAfterKobo: { type: Number, required: true },
    debtAfterKobo: { type: Number, required: true },

    // Loose reference back to whatever caused this — a CourierRequest id
    // for earnings/debt, a Payout id for withdrawals, a DebtPayment id
    // for debt payments. Not a strict Mongoose ref since it can point at
    // three different collections depending on `type`.
    sourceId: { type: String, default: null },

    // Short label for the transaction list, e.g. "Hub delivery #HUB-48213"
    // or "Direct ride #DIR-77102" — computed once at write time so the
    // list never needs to join across collections to render.
    label: { type: String, required: true },

    status: {
      type: String,
      enum: ["completed", "pending", "paid", "failed"],
      default: "completed",
    },
  },
  { timestamps: true }
);

TransactionSchema.index({ courierUid: 1, createdAt: -1 });

export default models.Transaction || model("Transaction", TransactionSchema);