import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";
import Courier from "@/models/Courier";
import { COURIER_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

// crafteey-client calls this from its own origin, so it needs CORS.
const ALLOWED_ORIGIN = process.env.CLIENT_APP_ORIGIN || "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

const ACTIVE_STATUSES: string[] = [
  COURIER_STATUS.ACCEPTED,
  COURIER_STATUS.PICKED_UP,
  COURIER_STATUS.EN_ROUTE,
];

// Bank code -> bank name, cached for an hour.
let bankCache: { code: string; name: string }[] | null = null;
let bankCachedAt = 0;

async function bankNameFor(code: string | null | undefined): Promise<string | null> {
  if (!code) return null;
  try {
    if (!bankCache || Date.now() - bankCachedAt > 60 * 60 * 1000) {
      const res = await fetch("https://api.paystack.co/bank?currency=NGN", {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      });
      const json = await res.json();
      if (!res.ok || !json.status) return null;
      bankCache = (json.data as { code: string; name: string }[]).map((b) => ({
        code: b.code,
        name: b.name,
      }));
      bankCachedAt = Date.now();
    }
    return bankCache.find((b) => b.code === code)?.name ?? null;
  } catch {
    return null;
  }
}

// Payment info for a delivery. The client also gets the courier's bank
// details here, but only for their own transfer-paid, active delivery.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const request = await CourierRequest.findById(params.id).lean();
    if (!request) return reply({ error: "Request not found" }, 404);
    if (request.clientUid !== uid && request.courierUid !== uid) {
      return reply({ error: "Not authorized" }, 403);
    }

    let bank: { bankName: string | null; accountName: string; accountNumber: string } | null = null;
    if (
      request.clientUid === uid &&
      request.paymentMethod === "transfer" &&
      request.courierUid &&
      ACTIVE_STATUSES.includes(request.status)
    ) {
      const courier = await Courier.findOne({ firebaseUid: request.courierUid })
        .select("bankCode accountNumber accountName")
        .lean();
      if (courier?.accountNumber && courier?.accountName) {
        bank = {
          bankName: await bankNameFor(courier.bankCode),
          accountName: courier.accountName,
          accountNumber: courier.accountNumber,
        };
      }
    }

    return reply({
      totalFeeKobo: typeof request.totalFeeKobo === "number" ? request.totalFeeKobo : null,
      paymentMethod: request.paymentMethod ?? "cash",
      paymentStatus: request.paymentStatus ?? "unpaid",
      bank,
    });
  } catch (err) {
    if (err instanceof AuthError) return reply({ error: err.message }, err.status);
    console.error("GET /api/courier-requests/[id]/payment failed:", err);
    return reply({ error: "Server error" }, 500);
  }
}

// action "client_paid": the client says they sent the transfer.
// action "collect": the rider confirms the money is in hand.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const request = await CourierRequest.findById(params.id);
    if (!request) return reply({ error: "Request not found" }, 404);

    if (request.source !== "direct" || typeof request.totalFeeKobo !== "number") {
      return reply({ error: "There is no payment step for this delivery" }, 409);
    }

    if (body.action === "client_paid") {
      if (request.clientUid !== uid) return reply({ error: "Not your delivery" }, 403);
      if (request.paymentMethod !== "transfer") {
        return reply({ error: "This delivery is paid in cash" }, 409);
      }
      if (
        request.status !== COURIER_STATUS.PICKED_UP &&
        request.status !== COURIER_STATUS.EN_ROUTE
      ) {
        return reply({ error: "You can pay once your package is on its way" }, 409);
      }
      if (request.paymentStatus === "unpaid") {
        await CourierRequest.updateOne(
          { _id: params.id, paymentStatus: "unpaid" },
          { $set: { paymentStatus: "client_marked_paid", clientMarkedPaidAt: new Date() } }
        );
      }
      const fresh = await CourierRequest.findById(params.id).select("paymentStatus").lean();
      return reply({ paymentStatus: fresh?.paymentStatus ?? "client_marked_paid" });
    }

    if (body.action === "collect") {
      if (request.courierUid !== uid) return reply({ error: "Not your delivery" }, 403);
      if (request.status !== COURIER_STATUS.EN_ROUTE) {
        return reply({ error: "You can collect payment once you're heading to the drop-off" }, 409);
      }
      await CourierRequest.updateOne(
        { _id: params.id, courierUid: uid, paymentStatus: { $ne: "collected" } },
        { $set: { paymentStatus: "collected", paymentCollectedAt: new Date() } }
      );
      return reply({ paymentStatus: "collected" });
    }

    return reply({ error: "Unknown action" }, 400);
  } catch (err) {
    if (err instanceof AuthError) return reply({ error: err.message }, err.status);
    console.error("PATCH /api/courier-requests/[id]/payment failed:", err);
    return reply({ error: "Server error" }, 500);
  }
}