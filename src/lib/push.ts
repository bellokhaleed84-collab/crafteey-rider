import { getMessaging } from "firebase-admin/messaging";
import { adminApp } from "@/lib/firebase/adminApp";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import CourierRequest from "@/models/CourierRequest";
import { COURIER_ACCOUNT_STATUS, COURIER_STATUS } from "@/lib/constants";

// Must match the channel the app creates in NativeSetup.tsx.
export const NEW_REQUEST_CHANNEL = "new_requests";

function clip(text: string, max: number): string {
  const s = text || "";
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

function naira(kobo: number): string {
  return "\u20A6" + Math.round(kobo / 100).toLocaleString("en-NG");
}

// Sends a loud push to every online, approved, not-suspended rider whose
// vehicle type matches the request (first rider to accept wins, same as
// the in-app queue).
export async function notifyNewRequest(requestId: string): Promise<{ sent: number; reason?: string }> {
  await connectToDatabase();

  const request: any = await CourierRequest.findById(requestId).lean();
  if (!request || request.status !== COURIER_STATUS.PENDING || request.courierUid) {
    return { sent: 0, reason: "not_pending" };
  }

  const couriers: any[] = await Courier.find({
    isOnline: true,
    status: COURIER_ACCOUNT_STATUS.APPROVED,
    accountSuspended: { $ne: true },
    vehicleType: request.vehicleType,
    "fcmTokens.0": { $exists: true },
    firebaseUid: { $nin: request.declinedBy ?? [] },
  })
    .select("fcmTokens")
    .limit(300)
    .lean();

  const tokens: string[] = Array.from(new Set(couriers.flatMap((c) => c.fcmTokens ?? [])));
  if (tokens.length === 0) return { sent: 0, reason: "no_riders" };

  const earn =
    typeof request.riderEarningKobo === "number" ? "Earn " + naira(request.riderEarningKobo) + " \u2022 " : "";
  const title = request.source === "hub" ? "New order to deliver" : "New delivery request";
  const body = earn + clip(request.pickup, 40) + " \u2192 " + clip(request.dropoff, 40);

  const messaging = getMessaging(adminApp);
  let sent = 0;

  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data: { type: "new_request", requestId: String(request._id) },
      android: {
        priority: "high",
        ttl: 60000,
        collapseKey: "req-" + String(request._id),
        notification: {
          channelId: NEW_REQUEST_CHANNEL,
          sound: "default",
          priority: "max",
          defaultVibrateTimings: true,
        },
      },
    });

    sent += res.successCount;

    const dead: string[] = [];
    res.responses.forEach((r, idx) => {
      if (r.success) return;
      const code = r.error?.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        dead.push(batch[idx]);
      }
    });
    if (dead.length > 0) {
      await Courier.updateMany({ fcmTokens: { $in: dead } }, { $pull: { fcmTokens: { $in: dead } } });
    }
  }

  return { sent };
}