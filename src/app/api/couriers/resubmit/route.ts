import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import { COURIER_ACCOUNT_STATUS } from "@/lib/constants";
import { ID_TYPES } from "@/lib/riderSignup";

export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// A rejected rider sends a new document photo (already uploaded straight to
// Cloudinary with the signature from /api/couriers/upload-signature).
// The application goes back to "pending" so the admin can look at it again.
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const body = (await req.json().catch(() => ({}))) as { idType?: unknown; idPhotoUrl?: unknown };

    const idPhotoUrl = typeof body.idPhotoUrl === "string" ? body.idPhotoUrl : "";
    if (!idPhotoUrl.startsWith("https://res.cloudinary.com/") || !idPhotoUrl.includes("/crafteey/rider-ids/")) {
      return bad("A photo of your document is required.");
    }

    let idType: string | undefined;
    if (body.idType !== undefined && body.idType !== "") {
      if (typeof body.idType !== "string" || !(ID_TYPES as readonly string[]).includes(body.idType)) {
        return bad("Choose which ID you are using.");
      }
      idType = body.idType;
    }

    const set: Record<string, unknown> = {
      status: COURIER_ACCOUNT_STATUS.PENDING,
      idPhotoUrl,
      rejectionReason: "",
      resubmittedAt: new Date(),
    };
    if (idType) set.idType = idType;

    // Only a rejected application can be sent again.
    const updated = await Courier.findOneAndUpdate(
      { firebaseUid: uid, status: COURIER_ACCOUNT_STATUS.REJECTED },
      { $set: set },
      { new: true }
    );

    if (!updated) {
      const exists = await Courier.exists({ firebaseUid: uid });
      return exists
        ? bad("Your application isn't waiting for a new document.", 409)
        : bad("Courier profile not found", 404);
    }

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/couriers/resubmit failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}