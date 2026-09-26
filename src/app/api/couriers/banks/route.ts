import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AuthError } from "@/middleware/auth";

export const dynamic = "force-dynamic";

interface PaystackBank {
  name: string;
  code: string;
  active: boolean;
}

// Simple in-memory cache — Paystack's bank list barely ever changes, so
// there's no need to hit their API on every form load. Resets on
// redeploy, which is fine for a list this stable.
let cachedBanks: { name: string; code: string }[] | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(req: NextRequest) {
  try {
    await verifyToken(req); // riders only, same auth as the rest of /api/couriers

    if (cachedBanks && Date.now() - cachedAt < CACHE_TTL_MS) {
      return NextResponse.json({ banks: cachedBanks });
    }

    const res = await fetch("https://api.paystack.co/bank?currency=NGN", {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const json = await res.json();
    if (!res.ok || !json.status) {
      throw new Error(json.message || "Could not load bank list");
    }

    const banks = (json.data as PaystackBank[])
      .filter((b) => b.active)
      .map((b) => ({ name: b.name, code: b.code }))
      .sort((a, b) => a.name.localeCompare(b.name));

    cachedBanks = banks;
    cachedAt = Date.now();

    return NextResponse.json({ banks });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/couriers/banks failed:", err);
    return NextResponse.json({ error: "Could not load bank list" }, { status: 500 });
  }
}