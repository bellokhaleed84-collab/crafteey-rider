"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Camera,
  Car,
  Check,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Hash,
  Lock,
  Mail,
  Palette,
  Phone,
  Settings,
  Tag,
  User,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { VEHICLE_TYPES, REQUIRE_COURIER_APPROVAL, type VehicleType } from "@/lib/constants";
import {
  ID_TYPES,
  VEHICLE_COLORS,
  isAdultDob,
  maxDobString,
  normalizePhone,
  type IdType,
} from "@/lib/riderSignup";
import {
  AuthShell,
  AuthTopBar,
  BrandLockup,
  ErrorText,
  Field,
  OutlineButton,
  PrimaryButton,
  SelectField,
} from "@/components/auth/AuthUI";

const TOTAL_STEPS = 4;

const VEHICLE_LABELS: Record<VehicleType, string> = {
  bicycle: "Bicycle",
  motorcycle: "Motorcycle",
  cargo: "Cargo",
};

const VEHICLE_EMOJI: Record<VehicleType, string> = {
  bicycle: "\uD83D\uDEB2",
  motorcycle: "\uD83C\uDFCD\uFE0F",
  cargo: "\uD83D\uDE9A",
};

const ID_OPTIONS: { value: IdType; title: string; sub: string; Icon: LucideIcon }[] = [
  { value: "nin", title: "NIN", sub: "Identification Number", Icon: CreditCard },
  { value: "drivers_licence", title: "Driver's Licence", sub: "Valid licence card", Icon: Car },
  { value: "voters_card", title: "Voter's Card", sub: "Permanent voter's card", Icon: FileText },
];

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

export default function RegisterPage() {
  const router = useRouter();
  const { user, signUp, signIn, getIdToken } = useAuth();
  const signedIn = !!user;

  // 0 = intro, 1..4 = steps, 5 = success
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [vehicleType, setVehicleType] = useState<VehicleType>("motorcycle");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [plate, setPlate] = useState("");

  const [idType, setIdType] = useState<IdType | "">("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Signed in but never finished their profile: use the account they have.
  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user, email]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const noun = vehicleType === "cargo" ? "Vehicle" : "Bike";

  function validateStep(s: number): string | null {
    if (s === 1) {
      if (name.trim().length < 2) return "Enter your full name.";
      if (!normalizePhone(phone)) return "Enter a valid Nigerian phone number.";
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Enter a valid email address.";
      if (!isAdultDob(dob)) return "You must be 18 or older. Check your date of birth.";
      if (!signedIn && password.length < 6) return "Password must be at least 6 characters.";
    }
    if (s === 2) {
      if (!brand.trim()) return `Enter your ${noun.toLowerCase()} brand.`;
      if (!model.trim()) return `Enter your ${noun.toLowerCase()} model.`;
      if (!color) return `Select your ${noun.toLowerCase()} colour.`;
      if (vehicleType !== "bicycle" && plate.trim().length < 3) return "Enter your plate number.";
    }
    if (s === 3 && !idType) return "Choose which ID you will use.";
    if (s === 4 && !photoFile) return "Take or choose a photo of your document.";
    return null;
  }

  function next() {
    const v = validateStep(step);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setStep(step + 1);
  }

  function back() {
    setError(null);
    setStep(Math.max(0, step - 1));
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

  async function submit() {
    const v = validateStep(4);
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      // 1. Firebase account (skipped if they are already signed in).
      if (!user) {
        try {
          await signUp(email.trim(), password);
        } catch (err: any) {
          if (err?.code === "auth/email-already-in-use") {
            // Half-finished earlier signup: same email + password lets them continue.
            try {
              await signIn(email.trim(), password);
            } catch {
              throw new Error(
                "That email already has an account. Log in instead, or use a different email."
              );
            }
          } else if (err?.code === "auth/weak-password") {
            throw new Error("Password is too weak. Use at least 6 characters.");
          } else if (err?.code === "auth/invalid-email") {
            throw new Error("That email address doesn't look right.");
          } else {
            throw err;
          }
        }
      }

      const token = await getIdToken();
      if (!token) throw new Error("Couldn't sign you in. Try again.");

      // 2. Upload the document photo straight to Cloudinary.
      const sigRes = await fetch("/api/couriers/upload-signature", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sig = await sigRes.json().catch(() => ({}));
      if (!sigRes.ok) throw new Error(sig.error || "Photo upload isn't available right now.");

      const blob = await shrinkImage(photoFile as File);
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

      // 3. Create the courier profile.
      const res = await fetch("/api/couriers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          phone,
          dateOfBirth: dob,
          vehicleType,
          vehicleBrand: brand.trim(),
          vehicleModel: model.trim(),
          vehicleColor: color,
          vehiclePlate: plate.trim(),
          idType,
          idPhotoUrl: upData.secure_url,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.code === "exists") {
          setStep(5);
          return;
        }
        if (data.code === "phone_taken") {
          setStep(1);
        }
        throw new Error(data.error || "Couldn't create your rider profile.");
      }

      setStep(5);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Screens ----------

  if (step === 0) {
    return (
      <AuthShell>
        <div className="flex flex-1 flex-col">
          <div className="pt-4">
            <BrandLockup markWidth={44} />
          </div>

          <div className="mt-8">
            <h1 className="text-3xl font-bold leading-tight">
              Join Crafteey
              <br />
              Riders
            </h1>
            <p className="mt-3 text-sm text-white/80">
              Fill in your details to get started and start earning.
            </p>
          </div>

          <svg viewBox="0 0 320 200" className="mx-auto mt-6 w-full max-w-[280px]" aria-hidden="true">
            <ellipse cx="160" cy="176" rx="120" ry="9" fill="rgba(0,0,0,0.25)" />
            <circle cx="90" cy="148" r="26" fill="none" stroke="#c9b6ff" strokeWidth="8" />
            <circle cx="232" cy="148" r="26" fill="none" stroke="#c9b6ff" strokeWidth="8" />
            <path
              d="M90 148 L140 148 L168 100 L205 100 L232 148"
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect x="80" y="78" width="56" height="44" rx="6" fill="#FFC400" />
            <circle cx="190" cy="62" r="14" fill="#c9b6ff" />
            <path
              d="M190 78 L178 108 L205 100"
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="12"
              strokeLinecap="round"
            />
          </svg>

          <div className="mt-auto space-y-3 pt-8">
            <PrimaryButton onClick={() => setStep(1)}>Continue</PrimaryButton>
            <OutlineButton onClick={() => router.push("/login")}>
              Already have an account? <span className="font-bold text-[#FFC400]">Log In</span>
            </OutlineButton>
            <p className="pt-2 text-center text-xs text-white/70">Safe. Fast. Reliable.</p>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (step === 5) {
    return (
      <AuthShell>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#16a34a] shadow-[0_0_40px_rgba(34,197,94,0.45)]">
            <Check size={48} strokeWidth={3} className="text-white" />
          </div>
          <h1 className="mt-8 text-2xl font-bold">Registration Successful!</h1>
          <p className="mt-3 max-w-xs text-sm text-white/80">
            {REQUIRE_COURIER_APPROVAL
              ? "Your account has been created. We are checking your details. You can start delivering once you are approved."
              : "Your account has been created. Now you can start delivering."}
          </p>
        </div>
        <PrimaryButton onClick={() => router.replace("/")}>Continue</PrimaryButton>
      </AuthShell>
    );
  }

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
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />

      <AuthTopBar onBack={back} step={step} total={TOTAL_STEPS} />

      <div className="flex flex-1 flex-col">
        {step === 1 && (
          <>
            <h1 className="mt-6 text-2xl font-bold">Personal Information</h1>
            <p className="mt-1 text-sm text-white/80">Tell us about yourself.</p>

            <div className="mt-6 space-y-3.5">
              <Field
                label="Full Name"
                icon={<User size={20} />}
                placeholder="Enter your full name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Field
                label="Phone Number"
                icon={<Phone size={20} />}
                leading={
                  <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/90">
                    +234
                  </span>
                }
                placeholder="Enter your phone number"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Field
                label="Email Address"
                icon={<Mail size={20} />}
                placeholder="Enter your email address"
                type="email"
                autoComplete="email"
                disabled={signedIn && !!user?.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Field
                label="Date of Birth"
                icon={<Calendar size={20} />}
                type="date"
                max={maxDobString()}
                style={{ colorScheme: "dark" }}
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
              {!signedIn && (
                <Field
                  label="Password"
                  icon={<Lock size={20} />}
                  placeholder="At least 6 characters"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  right={
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      className="shrink-0 text-white/80"
                    >
                      {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  }
                />
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="mt-6 text-2xl font-bold">
              Vehicle Details{vehicleType === "cargo" ? " (Cargo)" : ""}
            </h1>
            <p className="mt-1 text-sm text-white/80">Provide your vehicle information.</p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {VEHICLE_TYPES.map((v) => {
                const active = v === vehicleType;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setVehicleType(v);
                      if (v === "bicycle") setPlate("");
                    }}
                    className={`relative flex flex-col items-center gap-1 rounded-2xl border py-3 text-sm ${
                      active ? "border-[#FFC400] bg-white/10" : "border-white/25 bg-white/[0.06]"
                    }`}
                  >
                    {active && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#FFC400] text-[#2a0a6b]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                    <span className="text-2xl">{VEHICLE_EMOJI[v]}</span>
                    <span>{VEHICLE_LABELS[v]}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 space-y-3.5">
              <Field
                label={`${noun} Brand`}
                icon={<Tag size={20} />}
                placeholder={`Enter ${noun.toLowerCase()} brand`}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
              <Field
                label="Model"
                icon={<Settings size={20} />}
                placeholder={`Enter ${noun.toLowerCase()} model`}
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
              <SelectField
                label="Color"
                icon={<Palette size={20} />}
                value={color}
                onChange={(e) => setColor(e.target.value)}
              >
                <option value="">{`Select ${noun.toLowerCase()} color`}</option>
                {VEHICLE_COLORS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectField>
              {vehicleType !== "bicycle" && (
                <Field
                  label="Plate Number"
                  icon={<Hash size={20} />}
                  placeholder="Enter plate number"
                  autoCapitalize="characters"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                />
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="mt-6 text-2xl font-bold">Document Verification</h1>
            <p className="mt-1 text-sm text-white/80">
              Upload a valid ID to verify your account. You can use either your NIN, Driver&apos;s
              Licence or Voter&apos;s Card.
            </p>

            <div className="mt-6 space-y-3">
              {ID_OPTIONS.map(({ value, title, sub, Icon }) => {
                const active = value === idType;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setIdType(value)}
                    className={`relative flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left ${
                      active ? "border-[#FFC400] bg-white/10" : "border-white/25 bg-white/[0.06]"
                    }`}
                  >
                    <Icon size={26} className="shrink-0 text-white/90" />
                    <span>
                      <span className="block text-sm font-semibold">{title}</span>
                      <span className="block text-xs text-white/70">{sub}</span>
                    </span>
                    {active && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#FFC400] text-[#2a0a6b]">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="mt-6 text-2xl font-bold">Upload Document</h1>
            <p className="mt-1 text-sm text-white/80">Take a clear photo of your document.</p>

            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="mt-5 flex h-52 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-white/30 bg-white/[0.06]"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Your document" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-2 text-sm text-white/80">
                  <Camera size={30} />
                  Tap to take a photo
                </span>
              )}
            </button>

            <ul className="mt-4 space-y-2 text-sm text-white/85">
              {[
                "Ensure all details are clear",
                "Good lighting (avoid shadows)",
                "Keep the document within the frame",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white/60">
                    <Check size={10} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-auto space-y-3 pt-6">
          <ErrorText>{error}</ErrorText>

          {step < 4 && <PrimaryButton onClick={next}>Next</PrimaryButton>}

          {step === 4 && (
            <>
              {photoFile ? (
                <PrimaryButton onClick={submit} disabled={submitting}>
                  {submitting ? "Submitting\u2026" : "Submit"}
                </PrimaryButton>
              ) : (
                <PrimaryButton onClick={() => cameraRef.current?.click()}>
                  Capture Document
                </PrimaryButton>
              )}
              <OutlineButton onClick={() => galleryRef.current?.click()} disabled={submitting}>
                Choose from Gallery
              </OutlineButton>
            </>
          )}
        </div>
      </div>
    </AuthShell>
  );
}