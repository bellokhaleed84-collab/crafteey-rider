import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const courier = await Courier.findOne({ firebaseUid: uid }).lean();

    return NextResponse.json({ courier: courier ?? null });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/couriers/me failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
