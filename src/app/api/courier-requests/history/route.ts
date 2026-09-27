import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status"); // optional — one of COURIER_STATUS, or omitted for all
    const source = sp.get("source"); // optional — "hub" | "direct"
    const limit = Math.min(Math.max(parseInt(sp.get("limit") || "20", 10) || 20, 1), 50);
    const page = Math.max(parseInt(sp.get("page") || "1", 10) || 1, 1);

    // Filtering by courierUid alone is enough to scope this to "requests
    // ever assigned to me" — no need to also filter status, since a
    // request only has courierUid set once someone has accepted it.
    const filter: Record<string, unknown> = { courierUid: uid };
    if (status) filter.status = status;
    if (source) filter.source = source;

    const [requests, total] = await Promise.all([
      CourierRequest.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CourierRequest.countDocuments(filter),
    ]);

    return NextResponse.json({
      requests: requests.map((r) => ({
        _id: String(r._id),
        pickup: r.pickup,
        dropoff: r.dropoff,
        receiverName: r.receiverName,
        vehicleType: r.vehicleType,
        source: r.source,
        orderNumber: r.orderNumber,
        vendorName: r.vendorName,
        status: r.status,
        riderEarningKobo: r.riderEarningKobo,
        platformCommissionKobo: r.platformCommissionKobo,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      page,
      hasMore: page * limit < total,
      total,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/courier-requests/history failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}