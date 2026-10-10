"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { COURIER_ACCOUNT_STATUS, REQUIRE_COURIER_APPROVAL } from "@/lib/constants";
import { ID_TYPES, type IdType } from "@/lib/riderSignup";
import {
  AuthShell,
  BrandLockup,
  ErrorText,
  OutlineButton,
  PrimaryButton,
} from "@/components/auth/AuthUI";

type CourierInfo = {
  status: string;
  rejectionReason?: string;
  idType?: string;
  resubmittedAt?: string | null;
};

const ID_LABELS: Record<IdType, string> = {
  nin: "NIN",
  drivers_licence: "Driver's Licence",
  voters_card: "Voter's Card",
};

// Shrinks a phone photo before upload so it is quick on mobile data.
async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export default function PendingPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut, getIdToken } = useAuth();

  const [courier, setCourier] = useState<CourierInfo | null>(null);
  const [idType, setIdType] = useState<IdType | "">("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const idTypeSetRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch("/api/couriers/me", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const c = data.courier;
      if (!c) {
        router.replace("/register");
        return;
      }
      // Approved, or waiting while the approval gate is off: carry on to the app.
      if (
        c.status === COURIER_ACCOUNT_STATUS.APPROVED ||
        (!REQUIRE_COURIER_APPROVAL && c.status === COURIER_ACCOUNT_STATUS.PENDING)
      ) {
        router.replace("/");
        return;
      }
      setCourier({
        status: c.status,
        rejectionReason: c.rejectionReason || "",
        idType: c.idType || "",
        resubmittedAt: c.resubmittedAt || null,
      });
      if (!idTypeSetRef.current && c.idType && (ID_TYPES as readonly string[]).includes(c.idType)) {
        idTypeSetRef.current = true;
        setIdType(c.idType as IdType);
      }
    } catch {
      // keep what is on screen; the next check will try again
    }
  }, [getIdToken, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [authLoading, user, load, router]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose a photo (JPG or PNG).");
      return;
    }
    setError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function send() {
    if (!photoFile) {
      setError("Take or choose a photo of your document.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Couldn't sign you in. Try again.");

      // 1. Upload the new photo straight to Cloudinary.
      const sigRes = await fetch("/api/couriers/upload-signature", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sig = await sigRes.json().catch(() => ({}));
      if (!sigRes.ok) throw new Error(sig.error || "Photo upload isn't available right now.");

      const blob = await shrinkImage(photoFile);
      const form = new FormData();
      form.append("file", blob, "document.jpg");
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("folder", sig.folder);
      form.append("signature", sig.signature);

      const upRes = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
        method: "POST",
        body: form,
      });
      const upData = await upRes.json().catch(() => ({}));
      if (!upRes.ok || !upData.secure_url) {
        throw new Error("Couldn't upload your document photo. Try again.");
      }

      // 2. Tell the server. It puts the application back to pending.
      const res = await fetch("/api/couriers/resubmit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ idType: idType || undefined, idPhotoUrl: upData.secure_url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't send your document. Try again.");

      setPhotoFile(null);
      setPhotoPreview(null);
      await load();
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  // ---------- Loading ----------
  if (authLoading || !courier) {
    return (
      <AuthShell>
        <div className="flex flex-1 flex-col items-center justify-center" aria-busy="true">
          <div className="h-24 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="mt-8 w-full animate-pulse space-y-3 rounded-2xl border border-white/10 bg-white/[0.06] p-6">
            <div className="h-5 w-2/3 rounded bg-white/15" />
            <div className="h-3 w-full rounded bg-white/10" />
            <div className="h-3 w-5/6 rounded bg-white/10" />
          </div>
        </div>
      </AuthShell>
    );
  }

  // ---------- Rejected ----------
  if (courier.status === COURIER_ACCOUNT_STATUS.REJECTED) {
    return (
      <AuthShell>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPick}
        />
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onPick} />

        <div className="flex flex-1 flex-col">
          <div className="pt-2">
            <BrandLockup markWidth={44} />
          </div>

          <div className="mt-6 rounded-2xl border border-[#ffb4b4]/40 bg-[#ff6b6b]/10 p-5">
            <h1 className="text-lg font-bold">Application rejected</h1>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-white/60">Reason</p>
            <p className="mt-1 text-sm text-white/90">
              {courier.rejectionReason ||
                "We could not accept your document. Please send a clear new photo."}
            </p>
          </div>

          <h2 className="mt-6 text-base font-bold">Send a new document</h2>
          <p className="mt-1 text-sm text-white/80">
            Take a clear photo. Good light, all details visible, nothing cut off.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {ID_TYPES.map((t) => {
              const active = t === idType;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setIdType(t)}
                  className={`rounded-xl border px-2 py-3 text-xs font-semibold ${
                    active ? "border-[#FFC400] bg-white/10" : "border-white/25 bg-white/[0.06]"
                  }`}
                >
                  {ID_LABELS[t]}
                </button>
              );
            })}
          </div>

          {photoPreview && (
            <div className="mt-4 h-44 w-full overflow-hidden rounded-2xl border-2 border-dashed border-white/30">
              <img src={photoPreview} alt="Your new document" className="h-full w-full object-cover" />
            </div>
          )}

          <div className="mt-auto space-y-3 pt-6">
            <ErrorText>{error}</ErrorText>

            {photoFile ? (
              <>
                <PrimaryButton onClick={send} disabled={sending}>
                  {sending ? "Sending\u2026" : "Send for review"}
                </PrimaryButton>
                <OutlineButton onClick={() => cameraRef.current?.click()} disabled={sending}>
                  Take another photo
                </OutlineButton>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FFC400] py-4 text-base font-bold text-[#2a0a6b]"
                >
                  <Camera size={22} />
                  Upload new document
                </button>
                <OutlineButton onClick={() => galleryRef.current?.click()}>
                  Choose from Gallery
                </OutlineButton>
              </>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-2 text-center text-xs text-white/70"
            >
              Log out
            </button>
          </div>
        </div>
      </AuthShell>
    );
  }

  // ---------- Pending ----------
  return (
    <AuthShell>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <BrandLockup markWidth={52} />
        <div className="mt-8 rounded-2xl border border-white/20 bg-white/[0.08] p-6">
          <h1 className="text-lg font-bold">Application under review</h1>
          <p className="mt-2 text-sm text-white/80">
            {courier.resubmittedAt
              ? "We got your new document. We are checking it again. You will be able to start accepting requests once you are approved."
              : "Thanks for signing up. We are verifying your details. This usually doesn't take long. You will be able to log in and start accepting requests once you are approved."}
          </p>
        </div>
      </div>
      <OutlineButton onClick={handleLogout}>Log out</OutlineButton>
    </AuthShell>
  );
}