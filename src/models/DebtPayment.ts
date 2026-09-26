import { Schema, models, model } from "mongoose";

// One row per debt settlement — either from wallet balance or a
// Paystack card payment. Kept as a record separate from just decrementing
// Courier.debtKobo, so a rider has a visible history of what they paid
// and when.
const DebtPaymentSchema = new Schema(
  {
    courierUid: { type: String, required: true, index: true },
    amountKobo: { type: Number, required: true },
    method: { type: String, enum: ["wallet", "paystack"], required: true },
    paystackReference: { type: String, default: null },
    status: { type: String, enum: ["success", "pending", "failed"], default: "success" },
  },
  { timestamps: true }
);

export default models.DebtPayment || model("DebtPayment", DebtPaymentSchema);