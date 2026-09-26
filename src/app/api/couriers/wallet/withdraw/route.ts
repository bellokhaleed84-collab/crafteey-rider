import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import Payout, { PAYOUT_STATUS } from "@/models/Payout";
import { initiateTransfer } from "@/lib/paystack";
import crypto from "crypto";

// Africa/Lagos has no DST and matches server UTC+1 assumptions closely
// enough for a day-of-week check — if the deployment's server clock runs
// in a different timezone, swap this for a proper timezone library.
function isWithdrawalDay(): boolean {
  const day = new Date().getDay(); // 0 = Sunday
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
      return NextResponse.json(
        { error: "Add your bank details before withdrawing" },
        { status: 400 }
      );
    }

    if (courier.walletBalanceKobo <= 0) {
      return NextResponse.json({ error: "No balance available to withdraw" }, { status: 400 });
    }

    const amount = courier.walletBalanceKobo;

    // Deduct immediately so a duplicate tap can't double-withdraw the
    // same balance — refunded below if the transfer fails to even start.
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

      // Paystack transfers are often asynchronous — "success" here means
      // accepted for processing in some setups, finalized in others.
      // Either way, the transfer webhook (not built here yet) should be
      // the source of truth for flipping this to PAID; this just reflects
      // Paystack's immediate response.
      payout.status = transfer.status === "success" ? PAYOUT_STATUS.PAID : PAYOUT_STATUS.PROCESSING;
      await payout.save();

      return NextResponse.json({ ok: true, amountKobo: amount, status: payout.status });
    } catch (e) {
      // Transfer never started — refund the wallet, mark the payout failed.
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