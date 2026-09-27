import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { isValidWebhookSignature } from "@/lib/paystack";
import Courier from "@/models/Courier";
import Payout, { PAYOUT_STATUS } from "@/models/Payout";
import Transaction, { TRANSACTION_TYPE } from "@/models/Transaction";

export const dynamic = "force-dynamic";

/**
 * Set this in Paystack Dashboard → Settings → API Keys & Webhooks,
 * alongside the debt-payment webhook:
 *   https://YOUR-RIDER-DOMAIN/api/couriers/wallet/webhook
 *
 * The withdraw route's response only reflects Paystack's *immediate*
 * acknowledgement of a Transfer request (often "pending" for non-instant
 * rails). This webhook is what actually moves a payout from PROCESSING
 * to a final PAID or FAILED state once Paystack confirms what happened.
 */
const TRANSFER_EVENTS = ["transfer.success", "transfer.failed", "transfer.reversed"];

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!isValidWebhookSignature(raw, req.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let evt: { event?: string; data?: { reference?: string; reason?: string } };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  if (!evt.event || !TRANSFER_EVENTS.includes(evt.event) || !evt.data?.reference) {
    return NextResponse.json({ received: true });
  }

  try {
    await connectToDatabase();
    const reference = evt.data.reference;

    const payout = await Payout.findOne({ paystackTransferRef: reference });

    // No match, or already resolved — ignore. This also makes the
    // handler safe against Paystack's occasional duplicate deliveries.
    if (!payout || payout.status === PAYOUT_STATUS.PAID || payout.status === PAYOUT_STATUS.FAILED) {
      return NextResponse.json({ received: true });
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

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("[couriers] wallet transfer webhook failed", e);
    return NextResponse.json({ error: "Retry" }, { status: 500 });
  }
}