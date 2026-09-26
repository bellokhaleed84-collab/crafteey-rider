import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import Payout, { PAYOUT_STATUS } from "@/models/Payout";
import Transaction, { TRANSACTION_TYPE } from "@/models/Transaction";
import { initiateTransfer } from "@/lib/paystack";
import crypto from "crypto";

function isWithdrawalDay(): boolean {
  const day = new Date().getDay();
  return day === 1 || day === 4; // Monday or Thursday
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    if (!isWithdrawalDay()) {
      return NextResponse.json(
        { error: "Withdrawals are only available on Mondays and Thursdays" },
        { status: 400 }
      );
    }

    const courier = await Courier.findOne({ firebaseUid: uid });
    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    if (!courier.paystackRecipientCode) {
      return NextResponse.json({ error: "Add your bank details before withdrawing" }, { status: 400 });
    }

    if (courier.walletBalanceKobo <= 0) {
      return NextResponse.json({ error: "No balance available to withdraw" }, { status: 400 });
    }

    const amount = courier.walletBalanceKobo;

    courier.walletBalanceKobo = 0;
    await courier.save();

    const reference = `payout-${uid}-${crypto.randomBytes(4).toString("hex")}`;
    const payout = await Payout.create({
      courierUid: uid,
      amountKobo: amount,
      status: PAYOUT_STATUS.PENDING,
      paystackTransferRef: reference,
    });

    try {
      const transfer = await initiateTransfer({
        amountKobo: amount,
        recipientCode: courier.paystackRecipientCode,
        reference,
      });

      payout.status = transfer.status === "success" ? PAYOUT_STATUS.PAID : PAYOUT_STATUS.PROCESSING;
      await payout.save();

      await Transaction.create({
        courierUid: uid,
        type: TRANSACTION_TYPE.WITHDRAWAL,
        amountKobo: amount,
        walletBalanceAfterKobo: 0,
        debtAfterKobo: courier.debtKobo,
        sourceId: String(payout._id),
        label: "Withdrawal to bank",
        status: payout.status === PAYOUT_STATUS.PAID ? "paid" : "pending",
      });

      return NextResponse.json({ ok: true, amountKobo: amount, status: payout.status });
    } catch (e) {
      courier.walletBalanceKobo += amount;
      await courier.save();
      payout.status = PAYOUT_STATUS.FAILED;
      payout.failureReason = e instanceof Error ? e.message : "Transfer failed";
      await payout.save();

      return NextResponse.json({ error: "Withdrawal failed — your balance has been restored" }, { status: 502 });
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/couriers/wallet/withdraw failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}