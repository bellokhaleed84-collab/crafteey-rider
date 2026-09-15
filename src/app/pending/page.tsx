"use client";

export default function PendingPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-bold text-amber-900">Application under review</h1>
        <p className="mt-2 text-sm text-amber-700">
          Thanks for signing up. We're verifying your details — this usually doesn't take long.
          You'll be able to log in and start accepting requests once you're approved.
        </p>
      </div>
    </div>
  );
}
