import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";

export async function PATCH(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const body = await req.json().catch(() => ({}));
    const { isOnline, location } = body as {
      isOnline?: boolean;
      location?: { lat: number; lng: number } | null;
    };

    if (typeof isOnline !== "boolean") {
      return NextResponse.json({ error: "isOnline must be a boolean" }, { status: 400 });
    }

    const update: Record<string, unknown> = { isOnline };
    if (isOnline && location && typeof location.lat === "number" && typeof location.lng === "number") {
      update.currentLocation = location;
    }
    if (!isOnline) {
      update.currentLocation = null;
    }

    const courier = await Courier.findOneAndUpdate(
      { firebaseUid: uid },
      { $set: update },
      { new: true }
    ).lean();

    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    return NextResponse.json({ courier });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/couriers/online failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}