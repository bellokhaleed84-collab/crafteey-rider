import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";

// Marks a request as declined by THIS rider only. It does not change
// request.status and does not touch courierUid — the request stays
// PENDING and open to every other matching rider. This is what the
// accept-window timeout (and any future explicit "decline" button)
// should call, instead of only hiding the card client-side.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const decoded = await verifyToken(req);
    await connectToDatabase();

    const updated = await CourierRequest.findOneAndUpdate(
      { _id: params.id, status: "PENDING", courierUid: null },
      { $addToSet: { declinedBy: decoded.uid } },
      { new: true }
    ).lean();

    if (!updated) {
      // Already accepted by someone else, or doesn't exist — either way,
      // nothing for this rider to do; not an error worth surfacing.
      return NextResponse.json({ ok: true, alreadyResolved: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/courier-requests/[id]/decline failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}