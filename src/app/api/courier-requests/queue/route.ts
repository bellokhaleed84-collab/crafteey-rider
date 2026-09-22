import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";
import Courier from "@/models/Courier";
import { COURIER_STATUS } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const decoded = await verifyToken(req);
    await connectToDatabase();

    const courier = await Courier.findOne({ firebaseUid: decoded.uid })
      .select("vehicleType")
      .lean();

    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    const requests = await CourierRequest.find({
      status: COURIER_STATUS.PENDING,
      courierUid: null,
      vehicleType: courier.vehicleType,
      declinedBy: { $ne: decoded.uid },
    })
      .sort({ createdAt: 1 })
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