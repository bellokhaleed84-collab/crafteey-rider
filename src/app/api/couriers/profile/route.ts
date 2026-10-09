import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import { AVATAR_IDS } from "@/lib/avatars";

// Updates any of: name, phone, avatarId. Send only what changed.
export async function PATCH(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const body = await req.json().catch(() => ({}));
    const { name, phone, avatarId } = body as { name?: unknown; phone?: unknown; avatarId?: unknown };

    const set: Record<string, string> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      set.name = name.trim();
    }

    if (phone !== undefined) {
      if (typeof phone !== "string" || !phone.trim()) {
        return NextResponse.json({ error: "Phone number cannot be empty" }, { status: 400 });
      }
      set.phone = phone.trim();
    }

    if (avatarId !== undefined) {
      if (typeof avatarId !== "string" || !AVATAR_IDS.includes(avatarId)) {
        return NextResponse.json({ error: "Please pick one of the avatars" }, { status: 400 });
      }
      set.avatarId = avatarId;
    }

    if (Object.keys(set).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const courier = await Courier.findOneAndUpdate({ firebaseUid: uid }, { $set: set }, { new: true });

    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      name: courier.name,
      phone: courier.phone,
      avatarId: courier.avatarId ?? "",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/couriers/profile failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}