import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import {
  VEHICLE_TYPES,
  COURIER_ACCOUNT_STATUS,
  REQUIRE_COURIER_APPROVAL,
} from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const existing = await Courier.findOne({ firebaseUid: uid });
    if (existing) {
      return NextResponse.json({ error: "Courier profile already exists" }, { status: 409 });
    }

    const body = await req.json();
    const { name, phone, vehicleType, vehiclePlate, idNumber } = body as {
      name?: string;
      phone?: string;
      vehicleType?: string;
      vehiclePlate?: string;
      idNumber?: string;
    };

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "phone is required" }, { status: 400 });
    }
    if (!vehicleType || !VEHICLE_TYPES.includes(vehicleType as (typeof VEHICLE_TYPES)[number])) {
      return NextResponse.json({ error: "A valid vehicleType is required" }, { status: 400 });
    }

    const courier = await Courier.create({
      firebaseUid: uid,
      name,
      phone,
      vehicleType,
      vehiclePlate: vehiclePlate ?? "",
      idNumber: idNumber ?? "",
      // Pre-launch testing: skip the approval queue entirely when the flag
      // is off, so new signups can log straight into the dashboard.
      status: REQUIRE_COURIER_APPROVAL
        ? COURIER_ACCOUNT_STATUS.PENDING
        : COURIER_ACCOUNT_STATUS.APPROVED,
    });

    return NextResponse.json({ courier }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/couriers failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}