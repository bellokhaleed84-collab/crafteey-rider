import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";
import Courier from "@/models/Courier";
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

    // One active job at a time — enforced here server-side, not just by
    // the dashboard redirecting when it notices an active request.
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

    // Atomic accept: the filter requires status still PENDING and
    // courierUid still null at the moment of the update, so if two
    // couriers hit Accept on the same request within milliseconds of each
    // other, only the first update actually matches and wins — the
    // second gets back null, not a corrupted double-assigned request.
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

    return NextResponse.json({ request });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/courier-requests/[id]/accept failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}