import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";
import { COURIER_STATUS } from "@/lib/constants";

// Forward-only transition table. This is the actual enforcement of what
// the project brief already described as existing ("server-side
// transition table") — nothing before this endpoint existed to enforce
// it, since this route was never built.
const NEXT_STATUS: Record<string, string> = {
  [COURIER_STATUS.ACCEPTED]: COURIER_STATUS.PICKED_UP,
  [COURIER_STATUS.PICKED_UP]: COURIER_STATUS.EN_ROUTE,
  [COURIER_STATUS.EN_ROUTE]: COURIER_STATUS.DELIVERED,
};

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

    // Atomic, conditioned on the status being exactly what was just read —
    // guards against a double-tap (or two open tabs) both trying to
    // advance the same request past the same stage at once.
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

    return NextResponse.json({ request: updated });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/courier-requests/[id]/status failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}