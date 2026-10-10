import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";
import DeliveryReport from "@/models/DeliveryReport";
import { COURIER_STATUS } from "@/lib/constants";
import { PROBLEM_REASONS } from "@/lib/reportReasons";

const ACTIVE_STATUSES: string[] = [
  COURIER_STATUS.ACCEPTED,
  COURIER_STATUS.PICKED_UP,
  COURIER_STATUS.EN_ROUTE,
];

const MAX_PROBLEM_REPORTS_PER_REQUEST = 5;

function readLocation(v: any): { lat: number; lng: number } | null {
  if (!v) return null;
  const lat = Number(v.lat);
  const lng = Number(v.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

// A rider reports a problem or sends an emergency alert on their own active
// delivery. It only saves a report - it never changes the delivery or money.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
    if (!ACTIVE_STATUSES.includes(request.status)) {
      return NextResponse.json({ error: "This delivery is no longer active." }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const kind = body?.kind;
    if (kind !== "problem" && kind !== "emergency") {
      return NextResponse.json({ error: "kind must be problem or emergency" }, { status: 400 });
    }

    let reason = "";
    if (kind === "problem") {
      reason = typeof body?.reason === "string" ? body.reason : "";
      if (!(PROBLEM_REASONS as readonly string[]).includes(reason)) {
        return NextResponse.json({ error: "Pick a reason first." }, { status: 400 });
      }
    } else {
      reason = "Emergency alert";
    }

    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
    const location = readLocation(body?.location);

    if (kind === "emergency") {
      const recent = await DeliveryReport.findOne({
        requestId: String(request._id),
        courierUid: uid,
        kind: "emergency",
        createdAt: { $gte: new Date(Date.now() - 60_000) },
      }).lean();
      if (recent) return NextResponse.json({ ok: true, duplicate: true });
    } else {
      const count = await DeliveryReport.countDocuments({
        requestId: String(request._id),
        courierUid: uid,
        kind: "problem",
      });
      if (count >= MAX_PROBLEM_REPORTS_PER_REQUEST) {
        return NextResponse.json(
          { error: "You've already sent several reports on this delivery." },
          { status: 429 }
        );
      }
    }

    await DeliveryReport.create({
      kind,
      requestId: String(request._id),
      courierUid: uid,
      courierName: request.courierName ?? "",
      courierPhone: request.courierPhone ?? "",
      clientName: request.clientName ?? "",
      pickup: request.pickup ?? "",
      dropoff: request.dropoff ?? "",
      source: request.source ?? "direct",
      orderNumber: request.orderNumber ?? null,
      reason,
      note,
      location,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/courier-requests/[id]/report failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}