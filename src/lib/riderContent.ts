export const CARD_ICONS = ["clock", "flame", "shield", "gift", "info", "megaphone", "zap", "bike"] as const;
export type CardIcon = (typeof CARD_ICONS)[number];

export const CARD_ICON_LABELS: Record<CardIcon, string> = {
  clock: "Clock",
  flame: "Flame (busy)",
  shield: "Shield (safety)",
  gift: "Gift (promo)",
  info: "Info",
  megaphone: "Megaphone",
  zap: "Bolt",
  bike: "Bike",
};

export const CARD_COLORS = ["orange", "blue", "green", "red", "slate"] as const;
export type CardColor = (typeof CARD_COLORS)[number];

export const CARD_COLOR_LABELS: Record<CardColor, string> = {
  orange: "Orange",
  blue: "Blue",
  green: "Green",
  red: "Red",
  slate: "Grey",
};

// Full class names so Tailwind keeps them.
export const CARD_COLOR_CLASSES: Record<CardColor, { box: string; icon: string; title: string; text: string }> = {
  orange: { box: "border-orange-200 bg-orange-50", icon: "bg-orange-500 text-white", title: "text-orange-900", text: "text-orange-800" },
  blue: { box: "border-blue-200 bg-blue-50", icon: "bg-blue-600 text-white", title: "text-blue-900", text: "text-blue-800" },
  green: { box: "border-emerald-200 bg-emerald-50", icon: "bg-emerald-600 text-white", title: "text-emerald-900", text: "text-emerald-800" },
  red: { box: "border-red-200 bg-red-50", icon: "bg-red-600 text-white", title: "text-red-900", text: "text-red-800" },
  slate: { box: "border-slate-200 bg-slate-50", icon: "bg-slate-700 text-white", title: "text-slate-900", text: "text-slate-700" },
};

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface CardSchedule {
  always: boolean;
  days: number[]; // 0 = Sunday ... 6 = Saturday
  start: string; // "HH:MM" Lagos time
  end: string; // "HH:MM" Lagos time
}

type Windowed = {
  enabled?: boolean;
  schedule?: Partial<CardSchedule> | null;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
};

export function toMinutes(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Is this card showing right now? Lagos time is UTC+1 all year. */
export function isCardActive(card: Windowed, nowMs: number = Date.now()): boolean {
  if (card.enabled === false) return false;
  if (card.startsAt && new Date(card.startsAt).getTime() > nowMs) return false;
  if (card.endsAt && new Date(card.endsAt).getTime() < nowMs) return false;

  const s = card.schedule;
  if (!s || s.always !== false) return true;

  const lagos = new Date(nowMs + 3600000);
  const day = lagos.getUTCDay();
  const minutes = lagos.getUTCHours() * 60 + lagos.getUTCMinutes();
  const start = toMinutes(s.start ?? "");
  const end = toMinutes(s.end ?? "");
  if (start === null || end === null) return false;
  const days = s.days ?? [];

  if (start === end) return days.includes(day); // whole day
  if (start < end) return days.includes(day) && minutes >= start && minutes < end;
  // Overnight window, like 22:00 to 02:00. The after-midnight part belongs to the day before.
  if (minutes >= start) return days.includes(day);
  if (minutes < end) return days.includes((day + 6) % 7);
  return false;
}