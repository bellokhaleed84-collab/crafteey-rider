import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { verifyToken, AuthError } from "@/middleware/auth";

export const dynamic = "force-dynamic";

// Gives a signed-in rider a short-lived signature so their phone can upload
// the document photo straight to Cloudinary (no big files through Vercel).
export async function GET(req: NextRequest) {
  try {
    await verifyToken(req);

    const cloudName =
      process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.error("Cloudinary env vars missing (need CLOUDINARY_CLOUD_NAME)");
      return NextResponse.json(
        { error: "Photo upload isn't available right now." },
        { status: 500 }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "crafteey/rider-ids";
    const signature = createHash("sha1")
      .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");

    return NextResponse.json({ cloudName, apiKey, timestamp, folder, signature });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/couriers/upload-signature failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}