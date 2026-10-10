import crypto from "crypto";
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

// Wrong delivery codes allowed before the delivery locks.
const MAX_CODE_ATTEMPTS = 5;

const LOCKED_MESSAGE =
  "Too many wrong codes, so this delivery is locked. Call the customer who booked and ask them to give the receiver the right code. Do not hand over the package without it.";

function codesMatch(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function hubStatusFor(next: string): string | null {
  if (next === COURIER_STATUS.PICKED_UP || next === COURIER_STATUS.EN_ROUTE) return "out_for_delivery";
  if (next === COURIER_STATUS.DELIVERED) return "delivered";
  return null;
}

// Short label for the transaction ledger. Falls back to a shortened id
// if orderNumber isn't set on this request.
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

    const body = (await req.json().catch(() => ({}))) as { code?: unknown };
    const submittedCode = typeof body?.code === "string" ? body.code.trim() : "";

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

    // Direct rides: the rider must confirm the payment before finishing.
    // Rides without a saved fee (older requests) skip this step.
    if (
      request.status === COURIER_STATUS.EN_ROUTE &&
      request.source === "direct" &&
      typeof request.totalFeeKobo === "number" &&
      request.totalFeeKobo > 0 &&
      request.paymentStatus !== "collected"
    ) {
      return NextResponse.json(
        { error: "Collect the payment before finishing the delivery." },
        { status: 409 }
      );
    }

    const set: Record<string, unknown> = { status: next };
    if (next === COURIER_STATUS.PICKED_UP) set.pickedUpAt = new Date();
    if (next === COURIER_STATUS.DELIVERED) set.deliveredAt = new Date();

    // Delivery code: the receiver gives the rider the 4 digits the customer
    // saw. Checked here, before anything is marked delivered or settled.
    // Requests with no saved code (older ones) skip this step.
    if (
      request.status === COURIER_STATUS.EN_ROUTE &&
      request.deliveryCodeRequired &&
      typeof request.deliveryCode === "string" &&
      request.deliveryCode.length > 0
    ) {
      if (!/^\d{4}$/.test(submittedCode)) {
        return NextResponse.json(
          { error: "Enter the 4-digit delivery code from the receiver." },
          { status: 400 }
        );
      }

      // Count the try first (atomically), then compare. This way many
      // requests sent at the same time can't get extra guesses.
      const counted = await CourierRequest.findOneAndUpdate(
        {
          _id: params.id,
          courierUid: uid,
          status: COURIER_STATUS.EN_ROUTE,
          deliveryCodeAttempts: { $lt: MAX_CODE_ATTEMPTS },
        },
        { $inc: { deliveryCodeAttempts: 1 } },
        { new: true }
      ).select("deliveryCodeAttempts");

      if (!counted) {
        return NextResponse.json(
          {
            error: LOCKED_MESSAGE,
            codeLocked: true,
          },
          { status: 429 }
        );
      }

      if (!codesMatch(submittedCode, request.deliveryCode)) {
        const left = Math.max(MAX_CODE_ATTEMPTS - (counted.deliveryCodeAttempts ?? MAX_CODE_ATTEMPTS), 0);
        return NextResponse.json(
          {
            error:
              left > 0
                ? `That code is wrong. ${left} ${left === 1 ? "try" : "tries"} left.`
                : LOCKED_MESSAGE,
            codeLocked: left <= 0,
          },
          { status: 422 }
        );
      }

      set.deliveryCodeVerifiedAt = new Date();
    }

    // The delivery code is for the customer and receiver only. Never send it to the rider.
    const updated = await CourierRequest.findOneAndUpdate(
      { _id: params.id, courierUid: uid, status: request.status },
      { $set: set },
      { new: true }
    ).select("-deliveryCode");

    if (!updated) {
      return NextResponse.json({ error: "Status already changed - refresh and try again" }, { status: 409 });
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