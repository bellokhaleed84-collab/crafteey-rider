import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import LegalDocument from "@/models/LegalDocument";

export const dynamic = "force-dynamic";

// body is null when the admin has not saved rider terms yet; the app then shows its starter text.
export async function GET(req: NextRequest) {
  try {
    await verifyToken(req);
    await connectToDatabase();

    const doc = await LegalDocument.findOne({ slug: "rider-terms" }).lean<{ body?: string; version?: number } | null>();
    return NextResponse.json({ body: doc?.body ?? null, version: doc?.version ?? 0 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("GET /api/rider-content/terms failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}