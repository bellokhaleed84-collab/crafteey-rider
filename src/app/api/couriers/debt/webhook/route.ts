import { NextRequest, NextResponse } from "next/server";
import { isValidWebhookSignature } from "@/lib/paystack";
import { handleDebtChargeEvent } from "@/lib/webhooks/debtWebhook";
import { handleTransferEvent } from "@/lib/webhooks/transferWebhook";

export const dynamic = "force-dynamic";

/**
 * The ONE webhook URL to register in Paystack Dashboard → Settings →
 * API Keys & Webhooks — Paystack only supports a single webhook URL per
 * account, so every event type (charge.success, transfer.success,
 * transfer.failed, transfer.reversed, and anything added later) comes
 * through here and gets routed to the right handler below.
 *
 *   https://crafteey-rider.vercel.app/api/couriers/webhook
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!isValidWebhookSignature(raw, req.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let evt: { event?: string; data?: { reference?: string; reason?: string } };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  // Each handler checks whether the event is one it cares about and
  // no-ops otherwise, so it's safe to call both unconditionally here.
  await handleDebtChargeEvent(evt);
  await handleTransferEvent(evt);

  return NextResponse.json({ received: true });
}