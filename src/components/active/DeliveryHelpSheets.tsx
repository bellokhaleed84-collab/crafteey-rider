"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronDown, Phone } from "lucide-react";
import type { LatLng } from "@/hooks/useGeolocation";
import { GIVE_UP_REASONS } from "@/lib/reportReasons";
import { COURIER_STATUS } from "@/lib/constants";

type GetToken = () => Promise<string | null>;

async function send(
  getIdToken: GetToken,
  method: "POST" | "PATCH",
  path: string,
  body: unknown
): Promise<void> {
  const token = await getIdToken();
  if (!token) throw new Error("You're not signed in.");
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
}

function SheetShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/50" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300" />
        <h2 className="text-lg font-extrabold text-brand">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ReasonList({
  reasons,
  value,
  onChange,
}: {
  reasons: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-4 space-y-2">
      {reasons.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`flex min-h-[52px] w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-transform duration-150 active:scale-[0.99] ${
            value === r ? "border-brand-accent bg-brand-accent/10 text-brand" : "border-slate-200 text-slate-700"
          }`}
        >
          <span>{r}</span>
          {value === r && <Check className="h-5 w-5 shrink-0 text-brand-accent" />}
        </button>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------
// Report a problem: every problem shows a solution. Nothing goes to admin.
// ----------------------------------------------------------------------
type ProblemRequest = {
  status: string;
  source?: string;
  totalFeeKobo?: number | null;
  clientName?: string;
  clientPhone?: string;
  pickupContactName?: string;
  pickupContactPhone?: string;
  receiverName?: string;
  receiverPhone?: string;
  deliveryCodeRequired?: boolean;
};

type Contact = { label: string; name: string; phone: string };
type ContactKey = "stage" | "pickup" | "receiver" | "customer";

type Problem = {
  id: string;
  title: string;
  text: string;
  contacts: ContactKey[];
};

function buildContacts(req: ProblemRequest, keys: ContactKey[]): Contact[] {
  const atPickup = req.status === COURIER_STATUS.ACCEPTED;
  const customer: Contact = {
    label: "Customer who booked",
    name: req.clientName || "Customer",
    phone: req.clientPhone || "",
  };
  const pickup: Contact = {
    label: "Pickup contact",
    name: req.pickupContactName || req.clientName || "Pickup contact",
    phone: req.pickupContactPhone || req.clientPhone || "",
  };
  const receiver: Contact = {
    label: "Receiver",
    name: req.receiverName || req.clientName || "Receiver",
    phone: req.receiverPhone || req.clientPhone || "",
  };

  const out: Contact[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    const c = k === "customer" ? customer : k === "pickup" ? pickup : k === "receiver" ? receiver : atPickup ? pickup : receiver;
    const key = c.phone || `${c.label}-${c.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function problemsFor(req: ProblemRequest): Problem[] {
  const atPickup = req.status === COURIER_STATUS.ACCEPTED;
  const enRoute = req.status === COURIER_STATUS.EN_ROUTE;
  const list: Problem[] = [
    {
      id: "no_answer",
      title: "Customer is not answering",
      text: "Call them below. If nobody picks up, try the other number, then send a message with the Chat button. Please wait at the location and do not leave.",
      contacts: ["stage", "customer"],
    },
    {
      id: "cant_find",
      title: "Can't find the address",
      text: "Call and ask them to guide you, or ask them to share their location in Chat. Stay where you are until you hear back.",
      contacts: ["stage", "customer"],
    },
  ];

  if (atPickup) {
    list.push({
      id: "not_ready",
      title: "Package is not ready at pickup",
      text: "Call the pickup contact and ask how long it will take. Please wait at the pickup point.",
      contacts: ["pickup", "customer"],
    });
  }

  if (enRoute && req.deliveryCodeRequired) {
    list.push({
      id: "no_code",
      title: "Receiver can't give the delivery code",
      text: "The code is only on the customer's app. Call the customer who booked and ask them to give the code to the receiver. If the delivery says it is locked, keep waiting and keep calling. Do not hand over the package without the code.",
      contacts: ["customer", "receiver"],
    });
  }

  if (req.source !== "hub" && typeof req.totalFeeKobo === "number" && req.totalFeeKobo > 0) {
    list.push({
      id: "payment",
      title: "Payment problem",
      text: "Call the customer and the receiver to settle the payment. For a transfer, check your bank app before you confirm. Do not hand over the package until you are paid.",
      contacts: ["customer", "receiver"],
    });
  }

  list.push({
    id: "other",
    title: "Something else",
    text: "Call the customer to sort it out. Stay at the location and wait.",
    contacts: ["customer", "stage"],
  });

  return list;
}

function ContactRow({ c }: { c: Contact }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
        <p className="truncate text-sm font-bold text-brand">{c.name}</p>
        <p className="truncate text-xs text-steel">{c.phone || "No number saved"}</p>
      </div>
      {c.phone ? (
        <a
          href={`tel:${c.phone}`}
          aria-label={`Call ${c.name}`}
          className="flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-accent px-5 text-sm font-bold text-white transition-transform duration-150 active:scale-[0.98]"
        >
          <Phone className="h-5 w-5" /> Call
        </a>
      ) : null}
    </div>
  );
}

export function ProblemSheet({
  getIdToken,
  onClose,
}: {
  requestId?: string;
  getIdToken: GetToken;
  location?: LatLng | null;
  onClose: () => void;
}) {
  const [req, setReq] = useState<ProblemRequest | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) throw new Error("no token");
        const res = await fetch("/api/courier-requests/active", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.request) throw new Error("failed");
        if (!cancelled) setReq(data.request);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  return (
    <SheetShell title="Report a problem" onClose={onClose}>
      <p className="mt-1 text-sm text-steel">Pick what is going wrong to see what to do.</p>

      {failed ? (
        <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-600">
          Couldn&apos;t load the delivery details. Close this and try again.
        </p>
      ) : !req ? (
        <div className="mt-4 space-y-2" aria-busy="true">
          <div className="h-[52px] animate-pulse rounded-xl bg-slate-200" />
          <div className="h-[52px] animate-pulse rounded-xl bg-slate-200" />
          <div className="h-[52px] animate-pulse rounded-xl bg-slate-200" />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {problemsFor(req).map((p) => {
            const isOpen = open === p.id;
            return (
              <div
                key={p.id}
                className={`overflow-hidden rounded-xl border ${
                  isOpen ? "border-brand-accent bg-brand-accent/5" : "border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? "" : p.id)}
                  className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-brand"
                >
                  <span>{p.title}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="space-y-3 px-4 pb-4">
                    <p className="text-sm text-slate-600">{p.text}</p>
                    <div className="space-y-2 rounded-xl bg-slate-50 p-2">
                      {buildContacts(req, p.contacts).map((c) => (
                        <ContactRow key={`${c.label}-${c.phone}`} c={c} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="mt-4 min-h-[52px] w-full rounded-xl py-3 text-sm font-semibold text-steel"
      >
        Back to delivery
      </button>
    </SheetShell>
  );
}

// ----------------------------------------------------------------------
// Give the job back (only before pickup)
// ----------------------------------------------------------------------
export function GiveUpSheet({
  requestId,
  getIdToken,
  onClose,
  onDone,
}: {
  requestId: string;
  getIdToken: GetToken;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    try {
      await send(getIdToken, "PATCH", `/api/courier-requests/${requestId}/release`, { reason });
      onDone();
    } catch (e: any) {
      setError(e.message || "Couldn't give the job back.");
      setSending(false);
    }
  }

  return (
    <SheetShell title="Give up this job?" onClose={onClose}>
      <p className="mt-1 text-sm text-steel">
        The job goes back to other riders and you won&apos;t be offered it again. You can only do this before you
        pick up.
      </p>
      <ReasonList reasons={GIVE_UP_REASONS} value={reason} onChange={setReason} />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={!reason || sending}
        className="mt-4 min-h-[56px] w-full rounded-xl bg-red-600 py-3.5 text-base font-bold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-50"
      >
        {sending ? "Giving back..." : "Give job back"}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 min-h-[52px] w-full rounded-xl py-3 text-sm font-semibold text-steel"
      >
        Keep the job
      </button>
    </SheetShell>
  );
}

// ----------------------------------------------------------------------
// Emergency
// ----------------------------------------------------------------------
export function EmergencySheet({
  requestId,
  getIdToken,
  location,
  onClose,
}: {
  requestId: string;
  getIdToken: GetToken;
  location: LatLng | null;
  onClose: () => void;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const mapLink = location ? `https://www.google.com/maps?q=${location.lat},${location.lng}` : "";
  const smsBody = location ? `I need help. My location: ${mapLink}` : "I need help.";
  const smsHref = `sms:?body=${encodeURIComponent(smsBody)}`;

  async function alertCrafteey() {
    if (state !== "idle") return;
    setState("sending");
    setError(null);
    try {
      await send(getIdToken, "POST", `/api/courier-requests/${requestId}/report`, {
        kind: "emergency",
        location,
      });
      setState("sent");
    } catch (e: any) {
      setError(e.message || "Couldn't send the alert.");
      setState("idle");
    }
  }

  return (
    <SheetShell title="Emergency" onClose={onClose}>
      <p className="mt-1 text-sm text-steel">If you are in danger, call 112 first.</p>

      <a
        href="tel:112"
        className="mt-4 flex min-h-[64px] w-full items-center justify-center rounded-2xl bg-red-600 text-xl font-extrabold text-white transition-transform duration-150 active:scale-[0.98]"
      >
        Call 112
      </a>

      <button
        type="button"
        onClick={alertCrafteey}
        disabled={state !== "idle"}
        className="mt-3 min-h-[56px] w-full rounded-xl bg-brand-accent py-3.5 text-base font-bold text-white transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
      >
        {state === "sending" ? "Sending..." : state === "sent" ? "Alert sent to Crafteey" : "Alert Crafteey"}
      </button>
      {state === "sent" && (
        <p className="mt-2 text-sm font-semibold text-emerald-600">
          Crafteey has your alert{location ? " and your live location" : ""}.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <a
        href={smsHref}
        className="mt-3 flex min-h-[56px] w-full items-center justify-center rounded-xl border border-slate-200 text-base font-semibold text-slate-700 transition-transform duration-150 active:scale-[0.98]"
      >
        Text my location
      </a>

      <p className="mt-4 text-xs text-slate-400">
        Crafteey may not see the alert right away. If you are in danger, call 112.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="mt-3 min-h-[52px] w-full rounded-xl py-3 text-sm font-semibold text-steel"
      >
        Close
      </button>
    </SheetShell>
  );
}