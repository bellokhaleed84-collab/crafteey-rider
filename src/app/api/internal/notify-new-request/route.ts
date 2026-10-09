import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import mongoose from "mongoose";
import { notifyNewRequest } from "@/lib/push";

export const dynamic = "force-dynamic";

function secretsMatch(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

// Called by crafteey-client right after a delivery request is created.
// Protected by a shared secret, not by a rider login.
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.INTERNAL_NOTIFY_SECRET;
    const given = req.headers.get("x-internal-secret") ?? "";
    if (!secret || !secretsMatch(given, secret)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const requestId = typeof body?.requestId === "string" ? body.requestId : "";
    if (!mongoose.isValidObjectId(requestId)) {
      return NextResponse.json({ error: "A valid requestId is required" }, { status: 400 });
    }

    const result = await notifyNewRequest(requestId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/internal/notify-new-request failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}