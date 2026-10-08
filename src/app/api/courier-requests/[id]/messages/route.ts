import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import CourierRequest from "@/models/CourierRequest";
import ChatMessage from "@/models/ChatMessage";
import { COURIER_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Identical copy in crafteey-client and crafteey-rider (shared Mongo).
const CHAT_OPEN_STATUSES: string[] = [
  COURIER_STATUS.ACCEPTED,
  COURIER_STATUS.PICKED_UP,
  COURIER_STATUS.EN_ROUTE,
];
const MAX_LEN = 1000;

type Role = "client" | "courier";

interface Participant {
  uid: string;
  role: Role;
  status: string;
  hasCourier: boolean;
}

async function getParticipant(req: NextRequest, id: string): Promise<Participant | NextResponse> {
  const { uid } = await verifyToken(req);
  await connectToDatabase();
  const request = await CourierRequest.findById(id).select("clientUid courierUid status").lean();
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  const role: Role | null =
    request.clientUid === uid ? "client" : request.courierUid === uid ? "courier" : null;
  if (!role) {
    return NextResponse.json({ error: "Not part of this delivery" }, { status: 403 });
  }
  return { uid, role, status: request.status, hasCourier: !!request.courierUid };
}

function toDto(m: any) {
  return {
    _id: String(m._id),
    senderRole: m.senderRole,
    text: m.text,
    createdAt: new Date(m.createdAt).toISOString(),
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const p = await getParticipant(req, params.id);
    if (p instanceof NextResponse) return p;

    const after = req.nextUrl.searchParams.get("after");
    let docs: any[];
    if (after && !Number.isNaN(Date.parse(after))) {
      docs = await ChatMessage.find({ requestId: params.id, createdAt: { $gte: new Date(after) } })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();
    } else {
      docs = (
        await ChatMessage.find({ requestId: params.id }).sort({ createdAt: -1 }).limit(200).lean()
      ).reverse();
    }

    return NextResponse.json({ messages: docs.map(toDto) });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/courier-requests/[id]/messages failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const p = await getParticipant(req, params.id);
    if (p instanceof NextResponse) return p;

    if (!p.hasCourier || !CHAT_OPEN_STATUSES.includes(p.status)) {
      return NextResponse.json(
        { error: "Chat is open while a courier is assigned to an active delivery." },
        { status: 409 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });
    }
    if (text.length > MAX_LEN) {
      return NextResponse.json({ error: "Message is too long" }, { status: 400 });
    }

    const msg = await ChatMessage.create({
      requestId: params.id,
      senderUid: p.uid,
      senderRole: p.role,
      text,
    });

    return NextResponse.json({ message: toDto(msg) }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/courier-requests/[id]/messages failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}