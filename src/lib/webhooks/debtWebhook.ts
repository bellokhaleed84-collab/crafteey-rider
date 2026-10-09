import { settleDebtPayment } from "@/lib/debtSettle";

/**
 * Handles Paystack charge.success events for debt-payment references.
 * The clearing itself lives in lib/debtSettle.ts, shared with the
 * /api/couriers/debt/confirm route the app calls after the popup closes.
 */
export async function handleDebtChargeEvent(evt: { event?: string; data?: { reference?: string } }) {
  if (evt.event !== "charge.success" || !evt.data?.reference?.startsWith("debt-")) {
    return;
  }

  try {
    await settleDebtPayment(evt.data.reference);
  } catch (e) {
    console.error("[couriers] debt webhook failed", e);
    // Swallow: the combined handler still answers 200 to Paystack.
    // The app's confirm route is the backup for a missed webhook.
  }
}