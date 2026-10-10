import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import SupportTicket from "@/models/SupportTicket";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

type MsgRow = { _id: unknown; senderRole: string; text: string; createdAt: Date };
type TicketDoc = {
  _id: unknown;
  category: string;
  subject: string;
  status: string;
  unreadClient: number;
  messages: MsgRow[];
  createdAt: Date;
  fixedAt?: Date;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** GET /api/support/tickets/[id] -> the report and its chat. Only the owner can open it. */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { uid } = await verifyToken(req);
    if (!mongoose.isValidObjectId(params.id)) return bad("Report not found", 404);
    await connectToDatabase();

    const t = (await SupportTicket.findOne({
      _id: params.id,
      clientUid: uid,
      userType: "rider",
    }).lean()) as unknown as TicketDoc | null;
    if (!t) return bad("Report not found", 404);

    if ((t.unreadClient ?? 0) > 0) {
      await SupportTicket.updateOne({ _id: params.id, clientUid: uid }, { $set: { unreadClient: 0 } });
    }

    return NextResponse.json({
      ticket: {
        id: String(t._id),
        category: t.category,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt,
        fixedAt: t.fixedAt ?? null,
        messages: (t.messages ?? []).map((m) => ({
          id: String(m._id),
          senderRole: m.senderRole,
          text: m.text,
          createdAt: m.createdAt,
        })),
      },
    });
  } catch (err) {
    if (err instanceof AuthError) return bad(err.message, err.status);
    console.error("GET /api/support/tickets/[id] failed:", err);
    return bad("Couldn't open this report.", 500);
  }
}