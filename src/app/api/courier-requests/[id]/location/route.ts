import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";
import { COURIER_STATUS } from "@/lib/constants";
import { setLiveLocation, getLiveLocation } from "@/lib/redis";
import { logLocationHistory } from "@/lib/postgres";

const ACTIVE_STATUSES: string[] = [
  COURIER_STATUS.ACCEPTED,
  COURIER_STATUS.PICKED_UP,
  COURIER_STATUS.EN_ROUTE,
];

// crafteey-client is a separate Vercel deployment (different origin), so
// its browser-side fetch to this endpoint needs explicit CORS. Set
// CLIENT_APP_ORIGIN in Vercel env vars to crafteey-client's real deployed
// URL — until that's set this falls back to "*" (works, but not locked
// down to just your own client app).
const ALLOWED_ORIGIN = process.env.CLIENT_APP_ORIGIN || "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// Called every ~8s by the rider's app while a delivery is in progress.
// This is the endpoint active/page.tsx has been calling all along — it
// simply didn't exist until now, so every ping so far has 404'd silently.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const body = await req.json().catch(() => ({}));
    const { lat, lng } = body as { lat?: number; lng?: number };
    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json({ error: "lat and lng must be numbers" }, { status: 400 });
    }

    const request = await CourierRequest.findById(params.id);
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (request.courierUid !== uid) {
      return NextResponse.json({ error: "Not your delivery" }, { status: 403 });
    }
    if (!ACTIVE_STATUSES.includes(request.status)) {
      return NextResponse.json({ error: "Delivery is not active" }, { status: 409 });
    }

    // Mongo stays the source of truth for "last known position" (what
    // GET falls back to once the Redis entry expires), and is what any
    // existing admin/client code that already reads courierLocation
    // continues to see.
    request.courierLocation = { lat, lng };
    await request.save();

    // Redis (live, self-expiring) and Postgres (permanent history) both
    // happen after the important write already succeeded — a failure in
    // either shouldn't fail the whole ping.
    await Promise.allSettled([
      setLiveLocation(params.id, { lat, lng }),
      logLocationHistory({ requestId: params.id, courierUid: uid, lat, lng }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("PATCH /api/courier-requests/[id]/location failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// For crafteey-client to poll the rider's live position during a
// delivery. Only the client who owns this request, or the courier
// themself, can read it — a rider's live location is not public data.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const request = await CourierRequest.findById(params.id).lean();
    if (!request) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404, headers: corsHeaders() }
      );
    }
    if (request.clientUid !== uid && request.courierUid !== uid) {
      return NextResponse.json(
        { error: "Not authorized to view this location" },
        { status: 403, headers: corsHeaders() }
      );
    }

    const live = await getLiveLocation(params.id);
    if (live) {
      return NextResponse.json(
        { lat: live.lat, lng: live.lng, live: true, updatedAt: live.updatedAt },
        { headers: corsHeaders() }
      );
    }

    // No live Redis entry — either the rider hasn't sent a ping yet, or
    // one existed and expired (GPS/permission/network dropped). Fall back
    // to Mongo's last known position, explicitly flagged as not live so
    // the client can show "last seen" rather than pretending it's current.
    if (request.courierLocation) {
      return NextResponse.json(
        {
          lat: request.courierLocation.lat,
          lng: request.courierLocation.lng,
          live: false,
          updatedAt: request.updatedAt,
        },
        { headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      { lat: null, lng: null, live: false, updatedAt: null },
      { headers: corsHeaders() }
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: corsHeaders() });
    }
    console.error("GET /api/courier-requests/[id]/location failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: corsHeaders() });
  }
}