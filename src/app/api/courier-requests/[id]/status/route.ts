import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";
import HubOrder from "@/models/HubOrder";
import Courier from "@/models/Courier";
import { COURIER_STATUS } from "@/lib/constants";

const NEXT_STATUS: Record<string, string> = {
  [COURIER_STATUS.ACCEPTED]: COURIER_STATUS.PICKED_UP,
  [COURIER_STATUS.PICKED_UP]: COURIER_STATUS.EN_ROUTE,
  [COURIER_STATUS.EN_ROUTE]: COURIER_STATUS.DELIVERED,
};

// Rider is suspended once accumulated debt goes strictly ABOVE this —
// exactly ₦8,000 (800000 kobo) does not trigger suspension, ₦8,000.01+
// does.
const DEBT_SUSPENSION_THRESHOLD_KOBO = 800_000;

// Maps a courier-side status transition onto the Hub order status the
// client actually sees. PICKED_UP and EN_ROUTE both read as
// "out_for_delivery" to the client — the distinction only matters
// internally to the courier flow.
function hubStatusFor(next: string): string | null {
  if (next === COURIER_STATUS.PICKED_UP || next === COURIER_STATUS.EN_ROUTE) return "out_for_delivery";
  if (next === COURIER_STATUS.DELIVERED) return "delivered";
  return null;
}

// Applies this delivery's earnings to the courier's wallet/debt exactly
// once. Direct bookings: the rider already collected the full cash fare
// from the client, so only the platform's cut is recorded — as debt owed
// back to Crafteey, not a deduction from anything the rider has. Hub
// orders: the client already paid in-app, so the rider's share is added
// to their withdrawable wallet balance.
//
// Guarded by earningsSettled + an atomic conditional update so a retried
// or duplicate call can never double-count the same delivery.
async function settleEarnings(request: {
  _id: unknown;
  courierUid: string | null;
  source: string;
  riderEarningKobo: number | null;
  platformCommissionKobo: number | null;
}) {
  if (!request.courierUid) return;

  const settleResult = await CourierRequest.findOneAndUpdate(
    { _id: request._id, earningsSettled: { $ne: true } },
    { $set: { earningsSettled: true } },
    { new: false } // we only care whether the match/update happened
  );
  if (!settleResult) return; // already settled — nothing to do

  if (request.source === "direct") {
    const commission = request.platformCommissionKobo ?? 0;
    if (commission <= 0) return;

    const courier = await Courier.findOneAndUpdate(
      { firebaseUid: request.courierUid },
      { $inc: { debtKobo: commission } },
      { new: true }
    );
    if (courier && courier.debtKobo > DEBT_SUSPENSION_THRESHOLD_KOBO && !courier.accountSuspended) {
      await Courier.updateOne({ firebaseUid: request.courierUid }, { $set: { accountSuspended: true } });
    }
  } else if (request.source === "hub") {
    const earning = request.riderEarningKobo ?? 0;
    if (earning <= 0) return;

    await Courier.updateOne(
      { firebaseUid: request.courierUid },
      { $inc: { walletBalanceKobo: earning, lifetimeEarningsKobo: earning } }
    );
  }
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

    if (next === COURIER_STATUS.DELIVERED) {
      await settleEarnings(updated).catch((e) =>
        console.error("[rider] failed to settle earnings on delivery", e)
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