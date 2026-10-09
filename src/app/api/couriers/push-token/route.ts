import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";

const MAX_TOKENS_PER_RIDER = 5;

function readToken(body: any): string | null {
  const t = body?.token;
  return typeof t === "string" && t.length >= 20 && t.length <= 4096 ? t : null;
}

// Saves this phone's push token for the signed-in rider.
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const token = readToken(await req.json().catch(() => ({})));
    if (!token) {
      return NextResponse.json({ error: "A valid token is required" }, { status: 400 });
    }

    const courier = await Courier.findOne({ firebaseUid: uid }).select("_id").lean();
    if (!courier) {
      // Mid-registration: the app retries a few seconds later.
      return NextResponse.json({ error: "Courier profile not found" }, { status: 404 });
    }

    // One phone token belongs to one rider at a time.
    await Courier.updateMany(
      { fcmTokens: token, firebaseUid: { $ne: uid } },
      { $pull: { fcmTokens: token } }
    );
    await Courier.updateOne({ firebaseUid: uid }, { $pull: { fcmTokens: token } });
    await Courier.updateOne(
      { firebaseUid: uid },
      { $push: { fcmTokens: { $each: [token], $slice: -MAX_TOKENS_PER_RIDER } } }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/couriers/push-token failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Removes this phone's token (called on log out so it stops getting pings).
export async function DELETE(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const token = readToken(await req.json().catch(() => ({})));
    if (!token) {
      return NextResponse.json({ error: "A valid token is required" }, { status: 400 });
    }

    await Courier.updateOne({ firebaseUid: uid }, { $pull: { fcmTokens: token } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("DELETE /api/couriers/push-token failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}