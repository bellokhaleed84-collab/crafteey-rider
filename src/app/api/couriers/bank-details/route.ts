import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import { resolveBankAccount, createTransferRecipient } from "@/lib/paystack";

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const body = await req.json().catch(() => ({}));
    const { bankCode, accountNumber } = body as { bankCode?: string; accountNumber?: string };

    if (!bankCode || !accountNumber) {
      return NextResponse.json({ error: "bankCode and accountNumber are required" }, { status: 400 });
    }

    const courier = await Courier.findOne({ firebaseUid: uid });
    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    // Confirms the account is real and gets the bank's name on file for
    // it — never trust a name the rider types in themselves.
    const resolved = await resolveBankAccount({ accountNumber, bankCode });

    const recipient = await createTransferRecipient({
      name: resolved.account_name,
      accountNumber,
      bankCode,
    });

    courier.bankCode = bankCode;
    courier.accountNumber = accountNumber;
    courier.accountName = resolved.account_name;
    courier.paystackRecipientCode = recipient.recipient_code;
    await courier.save();

    return NextResponse.json({
      accountName: resolved.account_name,
      bankCode,
      accountNumber,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/couriers/bank-details failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not verify bank details" },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const courier = await Courier.findOne({ firebaseUid: uid })
      .select("bankCode accountNumber accountName paystackRecipientCode")
      .lean();

    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    return NextResponse.json({
      hasBankDetails: Boolean(courier.paystackRecipientCode),
      bankCode: courier.bankCode || null,
      accountNumber: courier.accountNumber || null,
      accountName: courier.accountName || null,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/couriers/bank-details failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}