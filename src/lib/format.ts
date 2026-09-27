export function formatNaira(kobo: number): string {
  // Guards against undefined/NaN from older records that predate a field
  // being added to the schema (Mongoose only backfills defaults on new
  // documents, not existing ones) — shows ₦0 instead of ₦NaN.
  const safeKobo = Number.isFinite(kobo) ? kobo : 0;
  return `₦${Math.round(safeKobo / 100).toLocaleString()}`;
}

export function formatTransactionDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Expects "YYYY-MM-DD" as returned by earnings-summary's daily breakdown.
export function formatChartDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

// Earliest date (today or later) that falls on a withdrawal day (Mon/Thu).
export function nextWithdrawalDate(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  while (![1, 4].includes(d.getDay())) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

export function formatWithdrawalDate(d: Date): string {
  return d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "short" });
}