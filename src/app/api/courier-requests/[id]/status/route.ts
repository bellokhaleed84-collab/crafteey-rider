import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";
import HubOrder from "@/models/HubOrder";
import { COURIER_STATUS } from "@/lib/constants";

const NEXT_STATUS: Record<string, string> = {
  [COURIER_STATUS.ACCEPTED]: COURIER_STATUS.PICKED_UP,
  [COURIER_STATUS.PICKED_UP]: COURIER_STATUS.EN_ROUTE,
  [COURIER_STATUS.EN_ROUTE]: COURIER_STATUS.DELIVERED,
};

// Maps a courier-side status transition onto the Hub order status the
// client actually sees. PICKED_UP and EN_ROUTE both read as
// "out_for_delivery" to the client — the distinction only matters
// internally to the courier flow.
function hubStatusFor(next: string): string | null {
  if (next === COURIER_STATUS.PICKED_UP || next === COURIER_STATUS.EN_ROUTE) return "out_for_delivery";
  if (next === COURIER_STATUS.DELIVERED) return "delivered";
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const request = await CourierRequest.findById(params.id);
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (request.courierUid !== uid) {
      return NextResponse.json({ error: "Not your delivery" }, { status: 403 });
    }

    const next = NEXT_STATUS[request.status];
    if (!next) {
      return NextResponse.json(
        { error: `Can't advance status from "${request.status}"` },
        { status: 409 }
      );
    }

    const updated = await CourierRequest.findOneAndUpdate(
      { _id: params.id, courierUid: uid, status: request.status },
      { $set: { status: next } },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Status already changed — refresh and try again" },
        { status: 409 }
      );
    }

    if (updated.source === "hub" && updated.hubOrderId) {
      const hubStatus = hubStatusFor(next);
      if (hubStatus) {
        HubOrder.updateOne({ _id: updated.hubOrderId }, { $set: { status: hubStatus } }).catch((e) =>
          console.error("[rider] failed to sync hub order status", e)
        );
      }
    }

    return NextResponse.json({ request: updated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/courier-requests/[id]/status failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}