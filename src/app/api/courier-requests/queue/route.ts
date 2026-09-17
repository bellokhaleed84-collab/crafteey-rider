import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";
import { COURIER_STATUS } from "@/lib/constants";

// This is the endpoint dashboard/page.tsx has been polling every 6s —
// it never existed, so every poll 404'd and silently returned nothing,
// which is why new ride requests never showed up for couriers no matter
// how many clients created them.
export async function GET(req: NextRequest) {
  try {
    await verifyToken(req);
    await connectToDatabase();

    const requests = await CourierRequest.find({
      status: COURIER_STATUS.PENDING,
      courierUid: null,
    })
      .sort({ createdAt: 1 }) // oldest request first — first come, first served
      .limit(20)
      .lean();

    return NextResponse.json({ requests });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/courier-requests/queue failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}