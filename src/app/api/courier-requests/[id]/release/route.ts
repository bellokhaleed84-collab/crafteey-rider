import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";
import HubOrder from "@/models/HubOrder";
import DeliveryReport from "@/models/DeliveryReport";
import { COURIER_STATUS } from "@/lib/constants";
import { GIVE_UP_REASONS } from "@/lib/reportReasons";
import { notifyNewRequest } from "@/lib/push";

// A rider gives a job back BEFORE pickup. The request goes back to pending
// for other riders, and this rider is added to declinedBy so it is never
// offered to them again. No money is touched: earnings only settle on delivery.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    const request = await CourierRequest.findById(params.id);
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (request.courierUid !== uid) {
      return NextResponse.json({ error: "Not your delivery" }, { status: 403 });
    }
    if (request.status !== COURIER_STATUS.ACCEPTED) {
      return NextResponse.json(
        { error: "You can only give a job back before pickup. Report a problem instead." },
        { status: 409 }
      );
    }
    if ((request.paymentStatus ?? "unpaid") !== "unpaid") {
      return NextResponse.json(
        { error: "Payment has already started on this job. Report a problem instead." },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const reason =
      typeof body?.reason === "string" && (GIVE_UP_REASONS as readonly string[]).includes(body.reason)
        ? body.reason
        : "Something else";

    const updated = await CourierRequest.findOneAndUpdate(
      {
        _id: params.id,
        courierUid: uid,
        status: COURIER_STATUS.ACCEPTED,
        paymentStatus: { $in: ["unpaid", null] },
      },
      {
        $set: {
          status: COURIER_STATUS.PENDING,
          courierUid: null,
          courierName: null,
          courierPhone: null,
          courierLocation: null,
          acceptedAt: null,
        },
        $addToSet: { declinedBy: uid },
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: "Status already changed - refresh and try again" }, { status: 409 });
    }

    // Hub order: it was set to "preparing" when this rider accepted. Put it
    // back to "paid" (waiting for a rider), but only if it is still "preparing".
    if (updated.source === "hub" && updated.hubOrderId) {
      HubOrder.updateOne({ _id: updated.hubOrderId, status: "preparing" }, { $set: { status: "paid" } }).catch((e) =>
        console.error("[rider] failed to sync hub order status on release", e)
      );
    }

    DeliveryReport.create({
      kind: "gave_up",
      requestId: String(updated._id),
      courierUid: uid,
      courierName: request.courierName ?? "",
      courierPhone: request.courierPhone ?? "",
      clientName: updated.clientName ?? "",
      pickup: updated.pickup ?? "",
      dropoff: updated.dropoff ?? "",
      source: updated.source ?? "direct",
      orderNumber: updated.orderNumber ?? null,
      reason,
    }).catch((e: unknown) => console.error("[rider] failed to save give-up report", e));

    // Tell the other matching riders it is open again.
    notifyNewRequest(String(updated._id)).catch((e: unknown) =>
      console.error("[rider] failed to push after release", e)
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/courier-requests/[id]/release failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}