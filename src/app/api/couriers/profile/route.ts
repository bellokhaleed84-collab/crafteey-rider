import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";

export async function PATCH(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const body = await req.json().catch(() => ({}));
    const { name, phone } = body as { name?: string; phone?: string };

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
    }

    const courier = await Courier.findOneAndUpdate(
      { firebaseUid: uid },
      { $set: { name: name.trim(), phone: phone.trim() } },
      { new: true }
    );

    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, name: courier.name, phone: courier.phone });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/couriers/profile failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}