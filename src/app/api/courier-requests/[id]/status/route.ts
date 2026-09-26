import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";
import HubOrder from "@/models/HubOrder";
import Courier from "@/models/Courier";
import Transaction, { TRANSACTION_TYPE } from "@/models/Transaction";
import { COURIER_STATUS } from "@/lib/constants";

const NEXT_STATUS: Record<string, string> = {
  [COURIER_STATUS.ACCEPTED]: COURIER_STATUS.PICKED_UP,
  [COURIER_STATUS.PICKED_UP]: COURIER_STATUS.EN_ROUTE,
  [COURIER_STATUS.EN_ROUTE]: COURIER_STATUS.DELIVERED,
};

const DEBT_SUSPENSION_THRESHOLD_KOBO = 800_000;

function hubStatusFor(next: string): string | null {
  if (next === COURIER_STATUS.PICKED_UP || next === COURIER_STATUS.EN_ROUTE) return "out_for_delivery";
  if (next === COURIER_STATUS.DELIVERED) return "delivered";
  return null;
}

// Short label for the transaction ledger — falls back to a shortened id
// if orderNumber isn't set on this request (e.g. older documents from
// before orderNumber existed).
function transactionLabel(request: { source: string; orderNumber?: string | null; _id: unknown }): string {
  const idTail = String(request._id).slice(-6).toUpperCase();
  if (request.source === "hub") {
    return `Hub delivery #${request.orderNumber || idTail}`;
  }
  return `Direct ride #${request.orderNumber || idTail}`;
}

async function settleEarnings(request: {
  _id: unknown;
  courierUid: string | null;
  source: string;
  orderNumber?: string | null;
  riderEarningKobo: number | null;
  platformCommissionKobo: number | null;
}) {
  if (!request.courierUid) return;

  const settleResult = await CourierRequest.findOneAndUpdate(
    { _id: request._id, earningsSettled: { $ne: true } },
    { $set: { earningsSettled: true } },
    { new: false }
  );
  if (!settleResult) return;

  const label = transactionLabel(request);

  if (request.source === "direct") {
    const commission = request.platformCommissionKobo ?? 0;
    if (commission <= 0) return;

    const courier = await Courier.findOneAndUpdate(
      { firebaseUid: request.courierUid },
      { $inc: { debtKobo: commission } },
      { new: true }
    );
    if (!courier) return;

    if (courier.debtKobo > DEBT_SUSPENSION_THRESHOLD_KOBO && !courier.accountSuspended) {
      await Courier.updateOne({ firebaseUid: request.courierUid }, { $set: { accountSuspended: true } });
    }

    await Transaction.create({
      courierUid: request.courierUid,
      type: TRANSACTION_TYPE.DIRECT_RIDE_DEBT,
      amountKobo: commission,
      walletBalanceAfterKobo: courier.walletBalanceKobo,
      debtAfterKobo: courier.debtKobo,
      sourceId: String(request._id),
      label,
      status: "completed",
    });
  } else if (request.source === "hub") {
    const earning = request.riderEarningKobo ?? 0;
    if (earning <= 0) return;

    const courier = await Courier.findOneAndUpdate(
      { firebaseUid: request.courierUid },
      { $inc: { walletBalanceKobo: earning, lifetimeEarningsKobo: earning } },
      { new: true }
    );
    if (!courier) return;

    await Transaction.create({
      courierUid: request.courierUid,
      type: TRANSACTION_TYPE.HUB_EARNING,
      amountKobo: earning,
      walletBalanceAfterKobo: courier.walletBalanceKobo,
      debtAfterKobo: courier.debtKobo,
      sourceId: String(request._id),
      label,
      status: "completed",
    });
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
      return NextResponse.json({ error: `Can't advance status from "${request.status}"` }, { status: 409 });
    }

    const updated = await CourierRequest.findOneAndUpdate(
      { _id: params.id, courierUid: uid, status: request.status },
      { $set: { status: next } },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: "Status already changed — refresh and try again" }, { status: 409 });
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