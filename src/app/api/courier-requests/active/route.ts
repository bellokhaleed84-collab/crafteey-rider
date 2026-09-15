import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";
import { COURIER_STATUS } from "@/lib/constants";

// Statuses that mean "this courier has an active job in progress" —
// pending has no courier yet, delivered/cancelled are finished.
const ACTIVE_STATUSES = [
  COURIER_STATUS.ACCEPTED,
  COURIER_STATUS.PICKED_UP,
  COURIER_STATUS.EN_ROUTE,
];

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const activeRequest = await CourierRequest.findOne({
      courierUid: uid,
      status: { $in: ACTIVE_STATUSES },
    }).lean();

    return NextResponse.json({ request: activeRequest ?? null });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/courier-requests/active failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}