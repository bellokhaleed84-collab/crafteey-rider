export const ID_TYPES = ["nin", "drivers_licence", "voters_card"] as const;
export type IdType = (typeof ID_TYPES)[number];

export const VEHICLE_COLORS = [
  "Black",
  "White",
  "Silver",
  "Grey",
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Orange",
  "Brown",
  "Other",
] as const;

// Returns +234XXXXXXXXXX, or "" if the number isn't a valid Nigerian number.
export function normalizePhone(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("234")) return "+" + digits;
  if (digits.length === 11 && digits.startsWith("0")) return "+234" + digits.slice(1);
  if (digits.length === 10) return "+234" + digits;
  return "";
}

// All the ways the same number might be stored, for lookups.
export function phoneVariants(input: string): string[] {
  const n = normalizePhone(input);
  if (!n) return [];
  const local = n.slice(4);
  return [n, "0" + local, "234" + local, local];
}

export function maxDobString(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export function isAdultDob(dob: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const d = new Date(dob + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - 18);
  return d <= limit;
}