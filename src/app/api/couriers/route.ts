import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import {
  VEHICLE_TYPES,
  COURIER_ACCOUNT_STATUS,
  REQUIRE_COURIER_APPROVAL,
} from "@/lib/constants";
import { ID_TYPES, isAdultDob, normalizePhone, phoneVariants } from "@/lib/riderSignup";

function bad(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await verifyToken(req);
    await connectToDatabase();

    const existing = await Courier.findOne({ firebaseUid: uid });
    if (existing) {
      return bad("Courier profile already exists", 409, "exists");
    }

    const body = await req.json();
    const {
      name,
      phone,
      dateOfBirth,
      vehicleType,
      vehicleBrand,
      vehicleModel,
      vehicleColor,
      vehiclePlate,
      idType,
      idNumber,
      idPhotoUrl,
    } = body as Record<string, string | undefined>;

    const cleanName = (name ?? "").trim();
    if (cleanName.length < 2) return bad("Enter your full name.");

    const cleanPhone = normalizePhone(phone ?? "");
    if (!cleanPhone) return bad("Enter a valid Nigerian phone number.");

    if (!isAdultDob(dateOfBirth ?? "")) {
      return bad("You must be 18 or older to ride with Crafteey.");
    }

    if (!vehicleType || !VEHICLE_TYPES.includes(vehicleType as (typeof VEHICLE_TYPES)[number])) {
      return bad("A valid vehicleType is required");
    }
    if (!(vehicleBrand ?? "").trim() || !(vehicleModel ?? "").trim() || !(vehicleColor ?? "").trim()) {
      return bad("Enter your vehicle brand, model and colour.");
    }
    if (vehicleType !== "bicycle" && !(vehiclePlate ?? "").trim()) {
      return bad("Enter your plate number.");
    }

    if (!idType || !ID_TYPES.includes(idType as (typeof ID_TYPES)[number])) {
      return bad("Choose which ID you are using.");
    }
    if (typeof idPhotoUrl !== "string" || !idPhotoUrl.startsWith("https://res.cloudinary.com/")) {
      return bad("A photo of your document is required.");
    }

    const phoneTaken = await Courier.findOne({ phone: { $in: phoneVariants(cleanPhone) } });
    if (phoneTaken) {
      return bad("That phone number is already registered.", 409, "phone_taken");
    }

    const courier = await Courier.create({
      firebaseUid: uid,
      name: cleanName,
      phone: cleanPhone,
      email: email ?? "",
      dateOfBirth,
      vehicleType,
      vehicleBrand: (vehicleBrand ?? "").trim(),
      vehicleModel: (vehicleModel ?? "").trim(),
      vehicleColor: (vehicleColor ?? "").trim(),
      vehiclePlate: vehicleType === "bicycle" ? "" : (vehiclePlate ?? "").trim().toUpperCase(),
      idType,
      idNumber: idNumber ?? "",
      idPhotoUrl,
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