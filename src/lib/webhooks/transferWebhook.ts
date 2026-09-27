import Courier from "@/models/Courier";
import Payout, { PAYOUT_STATUS } from "@/models/Payout";
import Transaction, { TRANSACTION_TYPE } from "@/models/Transaction";
import { connectToDatabase } from "@/lib/mongodb";

const TRANSFER_EVENTS = ["transfer.success", "transfer.failed", "transfer.reversed"];

/**
 * Handles Paystack transfer.* events. Called from the single combined
 * webhook at /api/couriers/webhook — Paystack only allows one webhook
 * URL per account, so this is NOT its own route.
 *
 * The withdraw route's response only reflects Paystack's *immediate*
 * acknowledgement of a Transfer request (often "pending" for non-instant
 * rails). This is what actually moves a payout from PROCESSING to a
 * final PAID or FAILED state once Paystack confirms what happened.
 */
export async function handleTransferEvent(evt: {
  event?: string;
  data?: { reference?: string; reason?: string };
}) {
  if (!evt.event || !TRANSFER_EVENTS.includes(evt.event) || !evt.data?.reference) {
    return;
  }

  try {
    await connectToDatabase();
    const reference = evt.data.reference;

    const payout = await Payout.findOne({ paystackTransferRef: reference });

    // No match, or already resolved — ignore. This also makes the
    // handler safe against Paystack's occasional duplicate deliveries.
    if (!payout || payout.status === PAYOUT_STATUS.PAID || payout.status === PAYOUT_STATUS.FAILED) {
      return;
    }

    if (evt.event === "transfer.success") {
      payout.status = PAYOUT_STATUS.PAID;
      await payout.save();

      await Transaction.updateOne(
        { sourceId: String(payout._id), type: TRANSACTION_TYPE.WITHDRAWAL },
        { $set: { status: "paid" } }
      );
    } else {
      // transfer.failed or transfer.reversed — the money never left (or
      // came back), so give the rider their wallet balance back.
      payout.status = PAYOUT_STATUS.FAILED;
      payout.failureReason = evt.data.reason || evt.event;
      await payout.save();

      const courier = await Courier.findOne({ firebaseUid: payout.courierUid });
      if (courier) {
        courier.walletBalanceKobo += payout.amountKobo;
        await courier.save();
      }

      await Transaction.updateOne(
        { sourceId: String(payout._id), type: TRANSACTION_TYPE.WITHDRAWAL },
        {
          $set: {
            status: "failed",
            walletBalanceAfterKobo: courier ? courier.walletBalanceKobo : payout.amountKobo,
          },
        }
      );
    }
  } catch (e) {
    console.error("[couriers] wallet transfer webhook failed", e);
    // Swallow rather than throw — the combined handler responds 200 to
    // Paystack regardless, so a transient DB error here just gets
    // caught next time Paystack retries the delivery.
  }
}