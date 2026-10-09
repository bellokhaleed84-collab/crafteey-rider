import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { settleDebtPayment } from "@/lib/debtSettle";

export const dynamic = "force-dynamic";

// Called by the app right after the Paystack popup says "success".
// Asks Paystack directly, then clears the debt. Safe to call twice.
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);

    const body = await req.json().catch(() => ({}));
    const reference = typeof body.reference === "string" ? body.reference : "";
    if (!reference.startsWith("debt-")) {
      return NextResponse.json({ error: "Invalid payment reference" }, { status: 400 });
    }

    const out = await settleDebtPayment(reference, uid);

    if (out.result === "not_found") {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    if (out.result === "amount_mismatch") {
      return NextResponse.json(
        { error: "The amount paid does not match your debt. Please contact support." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, ...out });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/couriers/debt/confirm failed:", err);
    return NextResponse.json({ error: "Could not confirm your payment" }, { status: 500 });
  }
}