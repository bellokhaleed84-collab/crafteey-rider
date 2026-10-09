import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import VehicleChangeRequest from "@/models/VehicleChangeRequest";

export const dynamic = "force-dynamic";

const ALLOWED = ["bicycle", "motorcycle"];
const MAX_PHOTO_CHARS = 600000;
const PLATE_RE = /^[A-Z0-9 -]{3,12}$/;

// Latest change request (without the photo) so the screen can show its status.
export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();
    const change = await VehicleChangeRequest.findOne({ courierUid: uid })
      .sort({ createdAt: -1 })
      .select("-photoDataUrl")
      .lean();
    return NextResponse.json({ change: change ?? null });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/couriers/vehicle-change failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const body = await req.json().catch(() => ({}));
    const { vehicleType, plate, photoDataUrl } = body as {
      vehicleType?: string;
      plate?: string;
      photoDataUrl?: string;
    };

    if (!vehicleType || !ALLOWED.includes(vehicleType)) {
      return NextResponse.json({ error: "Choose bicycle or motorcycle." }, { status: 400 });
    }

    let cleanPlate = "";
    if (vehicleType === "motorcycle") {
      cleanPlate = (plate ?? "").trim().toUpperCase();
      if (!PLATE_RE.test(cleanPlate)) {
        return NextResponse.json({ error: "Enter the plate number of your motorcycle." }, { status: 400 });
      }
    }

    if (
      typeof photoDataUrl !== "string" ||
      !photoDataUrl.startsWith("data:image/jpeg;base64,") ||
      photoDataUrl.length > MAX_PHOTO_CHARS
    ) {
      return NextResponse.json({ error: "Add a clear photo of the vehicle." }, { status: 400 });
    }

    const courier = await Courier.findOne({ firebaseUid: uid });
    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    const pending = await VehicleChangeRequest.findOne({ courierUid: uid, status: "pending" }).select("_id").lean();
    if (pending) {
      return NextResponse.json({ error: "You already have a change waiting for approval." }, { status: 409 });
    }

    if (courier.vehicleType === vehicleType && vehicleType === "bicycle") {
      return NextResponse.json({ error: "A bicycle is already your vehicle." }, { status: 400 });
    }

    await VehicleChangeRequest.create({
      courierUid: uid,
      fromVehicleType: courier.vehicleType,
      vehicleType,
      plate: cleanPlate,
      photoDataUrl,
      status: "pending",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/couriers/vehicle-change failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}