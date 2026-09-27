import Courier from "@/models/Courier";
import DebtPayment from "@/models/DebtPayment";
import Transaction, { TRANSACTION_TYPE } from "@/models/Transaction";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyTransaction } from "@/lib/paystack";

const DEBT_SUSPENSION_THRESHOLD_KOBO = 800_000;

/**
 * Handles Paystack charge.success events for debt-payment references.
 * Called from the single combined webhook at /api/couriers/webhook —
 * this used to be its own route at /api/couriers/debt/webhook, moved
 * here because Paystack only allows one webhook URL per account.
 */
export async function handleDebtChargeEvent(evt: { event?: string; data?: { reference?: string } }) {
  if (evt.event !== "charge.success" || !evt.data?.reference?.startsWith("debt-")) {
    return;
  }

  try {
    await connectToDatabase();
    const reference = evt.data.reference;

    const payment = await DebtPayment.findOne({ paystackReference: reference });
    if (!payment || payment.status === "success") {
      return;
    }

    const tx = await verifyTransaction(reference);
    if (tx.status !== "success") {
      await DebtPayment.updateOne({ _id: payment._id }, { $set: { status: "failed" } });
      return;
    }

    const courier = await Courier.findOne({ firebaseUid: payment.courierUid });
    if (!courier) return;

    const newDebt = Math.max(courier.debtKobo - payment.amountKobo, 0);
    courier.debtKobo = newDebt;
    if (newDebt <= DEBT_SUSPENSION_THRESHOLD_KOBO) courier.accountSuspended = false;
    await courier.save();

    await DebtPayment.updateOne({ _id: payment._id }, { $set: { status: "success" } });

    await Transaction.create({
      courierUid: payment.courierUid,
      type: TRANSACTION_TYPE.DEBT_PAYMENT,
      amountKobo: payment.amountKobo,
      walletBalanceAfterKobo: courier.walletBalanceKobo,
      debtAfterKobo: courier.debtKobo,
      sourceId: String(payment._id),
      label: "Debt paid by card",
      status: "completed",
    });
  } catch (e) {
    console.error("[couriers] debt webhook failed", e);
    // Swallow — the combined handler still responds 200 to Paystack;
    // a transient error here gets caught on Paystack's next retry.
  }
}