import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import SupportTicket, { MAX_TICKET_MESSAGES } from "@/models/SupportTicket";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** POST /api/support/tickets/[id]/messages  body: { text }. Refused once the report is fixed. */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { uid } = await verifyToken(req);
    if (!mongoose.isValidObjectId(params.id)) return bad("Report not found", 404);

    const body = await req.json().catch(() => null);
    const text = String(body?.text ?? "").trim();
    if (!text) return bad("Type a message first.");
    if (text.length > 1000) return bad("Messages can be up to 1000 characters.");

    await connectToDatabase();

    const now = new Date();
    const filter: Record<string, unknown> = {
      _id: params.id,
      clientUid: uid,
      userType: "rider",
      status: { $ne: "fixed" },
      [`messages.${MAX_TICKET_MESSAGES - 1}`]: { $exists: false },
    };

    const res = await SupportTicket.updateOne(filter, {
      $push: { messages: { senderRole: "client", senderName: "Rider", text, createdAt: now } },
      $set: { lastMessage: text.slice(0, 120), lastMessageAt: now },
      $inc: { unreadAdmin: 1 },
    });

    if (res.matchedCount === 0) {
      const t = (await SupportTicket.findOne({ _id: params.id, clientUid: uid, userType: "rider" })
        .select("status")
        .lean()) as unknown as { status?: string } | null;
      if (!t) return bad("Report not found", 404);
      if (t.status === "fixed") {
        return bad("This problem was marked fixed, so the chat is closed. Send a new report if you still need help.", 403);
      }
      return bad("This chat has reached its message limit. Please send a new report.", 409);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return bad(err.message, err.status);
    console.error("POST /api/support/tickets/[id]/messages failed:", err);
    return bad("Couldn't send your message. Try again.", 500);
  }
}