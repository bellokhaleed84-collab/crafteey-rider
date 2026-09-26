import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { isValidWebhookSignature, verifyTransaction } from "@/lib/paystack";
import Courier from "@/models/Courier";
import DebtPayment from "@/models/DebtPayment";

export const dynamic = "force-dynamic";

/**
 * Set this in Paystack Dashboard → Settings → API Keys & Webhooks:
 *   https://YOUR-RIDER-DOMAIN/api/couriers/debt/webhook
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!isValidWebhookSignature(raw, req.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let evt: { event?: string; data?: { reference?: string } };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  // Only handle references this webhook is responsible for — Hub's own
  // webhook lives in a different app and handles "hub-" references.
  if (evt.event === "charge.success" && evt.data?.reference?.startsWith("debt-")) {
    try {
      await connectToDatabase();
      const reference = evt.data.reference;

      const payment = await DebtPayment.findOne({ paystackReference: reference });
      if (!payment || payment.status === "success") {
        return NextResponse.json({ received: true });
      }

      const tx = await verifyTransaction(reference);
      if (tx.status !== "success") {
        await DebtPayment.updateOne({ _id: payment._id }, { $set: { status: "failed" } });
        return NextResponse.json({ received: true });
      }

      const courier = await Courier.findOne({ firebaseUid: payment.courierUid });
      if (!courier) return NextResponse.json({ received: true });

      // Clamp at 0 — if debt somehow changed between initiation and
      // confirmation (shouldn't happen, but never go negative).
      const newDebt = Math.max(courier.debtKobo - payment.amountKobo, 0);
      courier.debtKobo = newDebt;
      if (newDebt <= 800_000) courier.accountSuspended = false;
      await courier.save();

      await DebtPayment.updateOne({ _id: payment._id }, { $set: { status: "success" } });
    } catch (e) {
      console.error("[couriers] debt webhook failed", e);
      return NextResponse.json({ error: "Retry" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}