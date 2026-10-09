import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import RiderSection from "@/models/RiderSection";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await verifyToken(req);
    await connectToDatabase();

    const rows = await RiderSection.find({ enabled: true }).sort({ order: 1, createdAt: 1 }).lean();
    const sections = rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      description: r.description ?? "",
      icon: r.icon ?? "\uD83D\uDCCC",
      group: r.group === "core" ? "core" : "more",
      body: r.body ?? "",
    }));
    return NextResponse.json({ sections });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("GET /api/rider-content/sections failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}