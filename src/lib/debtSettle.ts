import Courier from "@/models/Courier";
import DebtPayment from "@/models/DebtPayment";
import Transaction, { TRANSACTION_TYPE } from "@/models/Transaction";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyTransaction } from "@/lib/paystack";

export const DEBT_SUSPENSION_THRESHOLD_KOBO = 800_000;

export type SettleResult =
  | { result: "settled"; debtKobo: number; walletBalanceKobo: number }
  | { result: "already_settled" }
  | { result: "not_found" }
  | { result: "not_paid"; paystackStatus: string }
  | { result: "amount_mismatch" };

/**
 * The ONE place a card debt payment gets cleared. Used by both the Paystack
 * webhook and the "confirm" route the app calls right after the popup closes.
 *
 * Safe to call many times, even at the same moment: the payment row is
 * claimed with a single atomic update, so only one caller can clear the debt.
 * Paystack is always asked directly, we never trust the caller.
 */
export async function settleDebtPayment(reference: string, ownerUid?: string): Promise<SettleResult> {
  await connectToDatabase();

  const payment = await DebtPayment.findOne({ paystackReference: reference });
  if (!payment) return { result: "not_found" };
  if (ownerUid && payment.courierUid !== ownerUid) return { result: "not_found" };
  if (payment.status === "success") return { result: "already_settled" };

  const tx = await verifyTransaction(reference);
  if (tx.status !== "success") return { result: "not_paid", paystackStatus: tx.status };

  if (tx.currency !== "NGN" || tx.amount < payment.amountKobo) {
    console.error("[debt] amount/currency mismatch", reference, tx.amount, tx.currency, payment.amountKobo);
    return { result: "amount_mismatch" };
  }

  // Claim it. Only one caller gets a result here.
  const previousStatus = payment.status;
  const claimed = await DebtPayment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: "success" } },
    { $set: { status: "success" } }
  );
  if (!claimed) return { result: "already_settled" };

  const revertClaim = () =>
    DebtPayment.updateOne({ _id: payment._id }, { $set: { status: previousStatus } });

  const amount = payment.amountKobo;
  let courier;
  try {
    // One atomic update: take the amount off the debt (never below zero),
    // then lift the suspension if the debt is now at or under the limit.
    courier = await Courier.findOneAndUpdate(
      { firebaseUid: payment.courierUid },
      [
        { $set: { debtKobo: { $max: [0, { $subtract: [{ $ifNull: ["$debtKobo", 0] }, amount] }] } } },
        {
          $set: {
            accountSuspended: {
              $cond: [{ $lte: ["$debtKobo", DEBT_SUSPENSION_THRESHOLD_KOBO] }, false, "$accountSuspended"],
            },
          },
        },
      ] as any,
      { new: true, timestamps: false }
    );
  } catch (e) {
    await revertClaim();
    throw e;
  }

  if (!courier) {
    await revertClaim();
    return { result: "not_found" };
  }

  // The debt is already cleared at this point. If the history row fails to
  // save, we only log it. Never undo the clearing, or a retry would clear twice.
  try {
    await Transaction.create({
      courierUid: payment.courierUid,
      type: TRANSACTION_TYPE.DEBT_PAYMENT,
      amountKobo: amount,
      walletBalanceAfterKobo: courier.walletBalanceKobo,
      debtAfterKobo: courier.debtKobo,
      sourceId: String(payment._id),
      label: "Debt paid by card",
      status: "completed",
    });
  } catch (e) {
    console.error("[debt] cleared but ledger row failed", reference, e);
  }

  return { result: "settled", debtKobo: courier.debtKobo, walletBalanceKobo: courier.walletBalanceKobo };
}