import { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "@/lib/firebase/adminApp";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

// Matches the same verifyToken/AuthError convention crafteey-client's
// courier-requests routes use, so status codes and error shapes line up
// on both sides of the same workflow.
export async function verifyToken(req: NextRequest): Promise<{ uid: string }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid Authorization header", 401);
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const decoded = await getAuth(adminApp).verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    throw new AuthError("Invalid or expired token", 401);
  }
}
