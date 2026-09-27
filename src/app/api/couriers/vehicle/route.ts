import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";

export async function PATCH(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const body = await req.json().catch(() => ({}));
    const { vehiclePlate, idNumber } = body as { vehiclePlate?: string; idNumber?: string };

    const update: Record<string, string> = {};
    if (typeof vehiclePlate === "string") update.vehiclePlate = vehiclePlate.trim();
    if (typeof idNumber === "string") update.idNumber = idNumber.trim();

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const courier = await Courier.findOneAndUpdate({ firebaseUid: uid }, { $set: update }, { new: true });
    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, vehiclePlate: courier.vehiclePlate, idNumber: courier.idNumber });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/couriers/vehicle failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}