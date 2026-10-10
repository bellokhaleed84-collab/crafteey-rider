import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Review from "@/models/Review";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/**
 * GET /api/couriers/ratings?summary=1        -> { average, count, distribution }
 * GET /api/couriers/ratings?before=<ISO>     -> next page of reviews, newest first
 * The first page (no "before") also carries the summary. Only published reviews
 * count, and customers show as first name only.
 */
export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const before = sp.get("before");
    const summaryOnly = sp.get("summary") === "1";

    const base = { targetType: "rider", targetId: uid, status: "published" };

    let summary: { average: number; count: number; distribution: Record<string, number> } | undefined;
    if (!before) {
      const rows = await Review.aggregate<{ _id: number; n: number }>([
        { $match: base },
        { $group: { _id: "$rating", n: { $sum: 1 } } },
      ]);
      const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
      let count = 0;
      let total = 0;
      for (const r of rows) {
        distribution[String(r._id)] = r.n;
        count += r.n;
        total += r._id * r.n;
      }
      summary = { average: count > 0 ? Math.round((total / count) * 10) / 10 : 0, count, distribution };
    }

    if (summaryOnly) return NextResponse.json(summary);

    const filter: Record<string, unknown> = { ...base };
    const beforeDate = before ? new Date(before) : null;
    if (beforeDate && !Number.isNaN(beforeDate.getTime())) filter.createdAt = { $lt: beforeDate };

    const rows = await Review.find(filter)
      .select("reviewerName rating comment createdAt")
      .sort({ createdAt: -1 })
      .limit(PAGE_SIZE + 1)
      .lean();

    const more = rows.length > PAGE_SIZE;
    const page = more ? rows.slice(0, PAGE_SIZE) : rows;

    return NextResponse.json({
      ...(summary ?? {}),
      reviews: page.map((r) => ({
        id: String(r._id),
        name: (r.reviewerName || "Customer").trim().split(/\s+/)[0],
        rating: r.rating,
        comment: r.comment ?? "",
        createdAt: new Date(r.createdAt).toISOString(),
      })),
      nextBefore: more ? new Date(page[page.length - 1].createdAt).toISOString() : null,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/couriers/ratings failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}