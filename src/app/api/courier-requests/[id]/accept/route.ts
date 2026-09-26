import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";
import Courier from "@/models/Courier";
import HubOrder from "@/models/HubOrder";
import { COURIER_STATUS } from "@/lib/constants";

const ACTIVE_STATUSES: string[] = [
  COURIER_STATUS.ACCEPTED,
  COURIER_STATUS.PICKED_UP,
  COURIER_STATUS.EN_ROUTE,
];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const courier = await Courier.findOne({ firebaseUid: uid });
    if (!courier) {
      return NextResponse.json({ error: "Courier profile not found" }, { status: 404 });
    }

    const alreadyActive = await CourierRequest.findOne({
      courierUid: uid,
      status: { $in: ACTIVE_STATUSES },
    });
    if (alreadyActive) {
      return NextResponse.json(
        { error: "You already have an active delivery" },
        { status: 409 }
      );
    }

    const request = await CourierRequest.findOneAndUpdate(
      { _id: params.id, status: COURIER_STATUS.PENDING, courierUid: null },
      {
        $set: {
          courierUid: uid,
          courierName: courier.name,
          courierPhone: courier.phone,
          status: COURIER_STATUS.ACCEPTED,
        },
      },
      { new: true }
    );

    if (!request) {
      return NextResponse.json(
        { error: "This request was just taken by another courier" },
        { status: 409 }
      );
    }

    // Keep the client's Hub order-tracking page in sync — a rider being
    // assigned means the order can now show as "preparing" (rider is
    // heading to the vendor). Fire-and-forget-ish: logged, not thrown,
    // so a sync failure never blocks the courier from accepting.
    if (request.source === "hub" && request.hubOrderId) {
      HubOrder.updateOne({ _id: request.hubOrderId }, { $set: { status: "preparing" } }).catch((e) =>
        console.error("[rider] failed to sync hub order status on accept", e)
      );
    }

    return NextResponse.json({ request });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/courier-requests/[id]/accept failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}