import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import RiderHomeCard from "@/models/RiderHomeCard";
import { isCardActive } from "@/lib/riderContent";

export const dynamic = "force-dynamic";

// Only the cards that are showing right now (switched on and inside their Lagos-time window).
export async function GET(req: NextRequest) {
  try {
    await verifyToken(req);
    await connectToDatabase();

    const rows = await RiderHomeCard.find({ enabled: true }).sort({ order: 1, createdAt: 1 }).lean();
    const now = Date.now();
    const cards = rows
      .filter((r) => isCardActive(r, now))
      .map((r) => ({
        _id: String(r._id),
        title: r.title,
        message: r.message ?? "",
        icon: r.icon ?? "info",
        color: r.color ?? "orange",
      }));
    return NextResponse.json({ cards });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("GET /api/rider-content/home-cards failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}