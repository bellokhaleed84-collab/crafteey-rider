import { Schema, models, model } from "mongoose";

// One row per Mon/Thu withdrawal a courier triggers. Tracks the batch
// separately from Courier.walletBalanceKobo so a failed Paystack Transfer
// never silently loses the courier's balance — status stays "failed" and
// the balance is left untouched for them to retry.
export const PAYOUT_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  PAID: "paid",
  FAILED: "failed",
} as const;

const PayoutSchema = new Schema(
  {
    courierUid: { type: String, required: true, index: true },
    amountKobo: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(PAYOUT_STATUS),
      default: PAYOUT_STATUS.PENDING,
      index: true,
    },
    paystackTransferRef: { type: String, default: null },
    failureReason: { type: String, default: null },
  },
  { timestamps: true }
);

export default models.Payout || model("Payout", PayoutSchema);