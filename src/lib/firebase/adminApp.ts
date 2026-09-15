import { initializeApp, getApps, cert, type App } from "firebase-admin/app";

// Same Firebase project as the other apps — service account credentials
// for this project, set as env vars in Vercel.
function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel env vars are single-line text — real newlines in the
      // private key get passed through as literal "\n" and need
      // converting back before Firebase Admin will accept them.
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const adminApp = getAdminApp();
