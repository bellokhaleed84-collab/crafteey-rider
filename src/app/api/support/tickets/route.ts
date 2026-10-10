import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import SupportTicket, { RIDER_CATEGORIES, type TicketCategory } from "@/models/SupportTicket";

export const dynamic = "force-dynamic";

const MAX_OPEN = 3;
const DAILY_LIMIT = 5;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type Row = {
  _id: unknown;
  category: string;
  subject: string;
  status: string;
  lastMessage: string;
  lastMessageAt: Date;
  unreadClient: number;
};

/** GET /api/support/tickets -> this rider's own reports, newest activity first. */
export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    await connectToDatabase();

    const rows = (await SupportTicket.find({ clientUid: uid, userType: "rider" })
      .select("-messages")
      .sort({ lastMessageAt: -1 })
      .limit(50)
      .lean()) as unknown as Row[];

    return NextResponse.json({
      tickets: rows.map((r) => ({
        id: String(r._id),
        category: r.category,
        subject: r.subject,
        status: r.status,
        lastMessage: r.lastMessage,
        lastMessageAt: r.lastMessageAt,
        unreadClient: r.unreadClient ?? 0,
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) return bad(err.message, err.status);
    console.error("GET /api/support/tickets failed:", err);
    return bad("Couldn't load your reports.", 500);
  }
}

/** POST /api/support/tickets  body: { category, message } */
export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyToken(req);
    const body = await req.json().catch(() => null);
    if (!body) return bad("Invalid request body");

    const categoryRaw = String(body.category ?? "");
    const message = String(body.message ?? "").trim();

    if (!(RIDER_CATEGORIES as readonly string[]).includes(categoryRaw)) {
      return bad("Choose what the problem is about.");
    }
    const category = categoryRaw as TicketCategory;
    if (message.length < 5) return bad("Tell us what went wrong in a few words.");
    if (message.length > 1000) return bad("Please keep it under 1000 characters.");

    await connectToDatabase();

    const courier = (await Courier.findOne({ firebaseUid: uid }).lean()) as unknown as {
      name?: string;
      email?: string;
      phone?: string;
    } | null;
    if (!courier) return bad("Complete your profile first.", 403);

    const openCount = await SupportTicket.countDocuments({
      clientUid: uid,
      userType: "rider",
      status: { $ne: "fixed" },
    });
    if (openCount >= MAX_OPEN) {
      return bad("You already have open reports. Open one of them and add your message there.", 429);
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await SupportTicket.countDocuments({
      clientUid: uid,
      userType: "rider",
      createdAt: { $gte: since },
    });
    if (recent >= DAILY_LIMIT) return bad("You've sent several reports today. Please try again tomorrow.", 429);

    const oneLine = message.replace(/\s+/g, " ");
    const subject = oneLine.length > 60 ? oneLine.slice(0, 57).trimEnd() + "..." : oneLine;
    const now = new Date();
    const name = courier.name || "Rider";

    const ticket = await SupportTicket.create({
      userType: "rider",
      clientUid: uid,
      clientName: name,
      clientEmail: courier.email || "",
      clientPhone: courier.phone || "",
      category,
      subject,
      status: "open",
      messages: [{ senderRole: "client", senderName: name, text: message, createdAt: now }],
      lastMessage: message.slice(0, 120),
      lastMessageAt: now,
      unreadAdmin: 1,
      unreadClient: 0,
    });

    return NextResponse.json({ id: String(ticket._id) }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return bad(err.message, err.status);
    console.error("POST /api/support/tickets failed:", err);
    return bad("Couldn't send your report. Try again.", 500);
  }
}