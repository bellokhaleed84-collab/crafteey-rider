import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import DebtPayment from "@/models/DebtPayment";
import Transaction, { TRANSACTION_TYPE } from "@/models/Transaction";
import { initializeTransaction } from "@/lib/paystack";
import crypto from "crypto";

const DEBT_SUSPENSION_THRESHOLD_KOBO = 800_000;

export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await verifyToken(req);
    await connectToDatabase();

    const body = await req.json().catch(() => ({}));
    const { method } = body as { method?: "wallet" | "paystack" };

    if (method !== "wallet" && method !== "paystack") {
      return NextResponse.json({ error: "method must be 'wallet' or 'paystack'" }, { status: 400 });
    }

    const courier = await Courier.findOne({ firebaseUid: uid });
    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    if (courier.debtKobo <= 0) {
      return NextResponse.json({ error: "You have no outstanding debt" }, { status: 400 });
    }

    if (method === "wallet") {
      if (courier.walletBalanceKobo < courier.debtKobo) {
        return NextResponse.json(
          { error: "Your wallet balance isn't enough to cover this debt" },
          { status: 400 }
        );
      }

      const amount = courier.debtKobo;
      courier.walletBalanceKobo -= amount;
      courier.debtKobo = 0;
      courier.accountSuspended = false;
      await courier.save();

      const payment = await DebtPayment.create({
        courierUid: uid,
        amountKobo: amount,
        method: "wallet",
        status: "success",
      });

      await Transaction.create({
        courierUid: uid,
        type: TRANSACTION_TYPE.DEBT_PAYMENT,
        amountKobo: amount,
        walletBalanceAfterKobo: courier.walletBalanceKobo,
        debtAfterKobo: courier.debtKobo,
        sourceId: String(payment._id),
        label: "Debt paid from wallet",
        status: "completed",
      });

      return NextResponse.json({ ok: true, debtKobo: 0, walletBalanceKobo: courier.walletBalanceKobo });
    }

    // Paystack card path — rider pays Crafteey directly for the debt amount.
    // No Transaction row here yet: written by the webhook once Paystack
    // actually confirms the payment succeeded.
    if (!email) {
      return NextResponse.json({ error: "No email on file for payment" }, { status: 400 });
    }

    const reference = `debt-${uid}-${crypto.randomBytes(4).toString("hex")}`;
    const init = await initializeTransaction({
      email,
      amountKobo: courier.debtKobo,
      reference,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin}/dashboard/earnings`,
      metadata: { courierUid: uid, purpose: "debt_payment" },
    });

    await DebtPayment.create({
      courierUid: uid,
      amountKobo: courier.debtKobo,
      method: "paystack",
      paystackReference: reference,
      status: "pending",
    });

    return NextResponse.json({
      accessCode: init.access_code,
      authorizationUrl: init.authorization_url,
      reference,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/couriers/debt/pay failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}