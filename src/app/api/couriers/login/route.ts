import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "@/lib/firebase/adminApp";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import { phoneVariants } from "@/lib/riderSignup";

const WRONG = "Wrong phone number or password.";

// Log in with a phone number. Checks the password with Firebase on the
// server, then hands back a custom token so the app can sign in.
// The rider's email is never sent to the phone.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier = typeof body.identifier === "string" ? body.identifier : "";
    const password = typeof body.password === "string" ? body.password : "";

    const variants = phoneVariants(identifier);
    if (variants.length === 0 || !password) {
      return NextResponse.json({ error: WRONG }, { status: 401 });
    }

    await connectToDatabase();
    const courier: any = await Courier.findOne({ phone: { $in: variants } }).lean();
    if (!courier?.firebaseUid) {
      return NextResponse.json({ error: WRONG }, { status: 401 });
    }

    const auth = getAuth(adminApp);

    let email: string | undefined;
    try {
      const fbUser = await auth.getUser(courier.firebaseUid);
      email = fbUser.email ?? undefined;
    } catch {
      return NextResponse.json({ error: WRONG }, { status: 401 });
    }
    if (!email) {
      return NextResponse.json({ error: WRONG }, { status: 401 });
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const check = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: false }),
      }
    );
    if (!check.ok) {
      return NextResponse.json({ error: WRONG }, { status: 401 });
    }

    const token = await auth.createCustomToken(courier.firebaseUid);
    return NextResponse.json({ token });
  } catch (err) {
    console.error("POST /api/couriers/login failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}