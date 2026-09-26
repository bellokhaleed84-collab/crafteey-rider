import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Transaction, { TRANSACTION_TYPE } from "@/models/Transaction";

export const dynamic = "force-dynamic";

const VALID_TYPES = Object.values(TRANSACTION_TYPE);

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const type = sp.get("type"); // one of TRANSACTION_TYPE, or omitted for "All"
    const limit = Math.min(Math.max(parseInt(sp.get("limit") || "20", 10) || 20, 1), 50);
    const page = Math.max(parseInt(sp.get("page") || "1", 10) || 1, 1);

    if (type && !VALID_TYPES.includes(type as any)) {
      return NextResponse.json({ error: "Invalid type filter" }, { status: 400 });
    }

    const filter: Record<string, unknown> = { courierUid: uid };
    if (type) filter.type = type;

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        _id: String(t._id),
        type: t.type,
        label: t.label,
        amountKobo: t.amountKobo,
        walletBalanceAfterKobo: t.walletBalanceAfterKobo,
        debtAfterKobo: t.debtAfterKobo,
        status: t.status,
        createdAt: t.createdAt,
      })),
      page,
      hasMore: page * limit < total,
      total,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/couriers/transactions failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}