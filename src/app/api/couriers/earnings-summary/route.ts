import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";

export const dynamic = "force-dynamic";

// Note on "cash to you" for direct rides: the customer pays the rider
// the FULL delivery fee in cash (riderEarningKobo + platformCommissionKobo
// combined) — only the platform's cut becomes debt. So direct-ride "cash"
// for the chart/summary is the sum of both fields, not just the earning
// share. Hub earnings are just riderEarningKobo, since that's the only
// part that ever reaches the rider.
function periodStartDate(period: string): Date | null {
  const now = new Date();
  if (period === "7days") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "30days") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return null; // "all" — no lower bound
}

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const period = req.nextUrl.searchParams.get("period") || "30days";
    const since = periodStartDate(period);

    const baseMatch: Record<string, unknown> = {
      courierUid: uid,
      status: "delivered",
      earningsSettled: true,
    };
    if (since) baseMatch.updatedAt = { $gte: since };

    // Daily breakdown for the stacked bar chart.
    const daily = await CourierRequest.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
          hubEarningKobo: {
            $sum: { $cond: [{ $eq: ["$source", "hub"] }, { $ifNull: ["$riderEarningKobo", 0] }, 0] },
          },
          directRideCashKobo: {
            $sum: {
              $cond: [
                { $eq: ["$source", "direct"] },
                { $add: [{ $ifNull: ["$riderEarningKobo", 0] }, { $ifNull: ["$platformCommissionKobo", 0] }] },
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // This calendar month's totals, regardless of the chart's period filter.
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthAgg = await CourierRequest.aggregate([
      { $match: { courierUid: uid, status: "delivered", earningsSettled: true, updatedAt: { $gte: monthStart } } },
      {
        $group: {
          _id: null,
          hubEarningKobo: {
            $sum: { $cond: [{ $eq: ["$source", "hub"] }, { $ifNull: ["$riderEarningKobo", 0] }, 0] },
          },
          directRideCashKobo: {
            $sum: {
              $cond: [
                { $eq: ["$source", "direct"] },
                { $add: [{ $ifNull: ["$riderEarningKobo", 0] }, { $ifNull: ["$platformCommissionKobo", 0] }] },
                0,
              ],
            },
          },
          commissionKobo: {
            $sum: { $cond: [{ $eq: ["$source", "direct"] }, { $ifNull: ["$platformCommissionKobo", 0] }, 0] },
          },
          hubDeliveries: { $sum: { $cond: [{ $eq: ["$source", "hub"] }, 1, 0] } },
          directRides: { $sum: { $cond: [{ $eq: ["$source", "direct"] }, 1, 0] } },
        },
      },
    ]);

    const month = monthAgg[0] ?? {
      hubEarningKobo: 0,
      directRideCashKobo: 0,
      commissionKobo: 0,
      hubDeliveries: 0,
      directRides: 0,
    };

    return NextResponse.json({
      daily: daily.map((d) => ({
        date: d._id,
        hubEarningKobo: d.hubEarningKobo,
        directRideCashKobo: d.directRideCashKobo,
      })),
      thisMonth: {
        hubEarningKobo: month.hubEarningKobo,
        directRideCashKobo: month.directRideCashKobo,
        commissionKobo: month.commissionKobo,
        hubDeliveries: month.hubDeliveries,
        directRides: month.directRides,
        totalDeliveries: month.hubDeliveries + month.directRides,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/couriers/earnings-summary failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}