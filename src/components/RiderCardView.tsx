import { Bike, Clock, Flame, Gift, Info, Megaphone, Shield, Zap, type LucideIcon } from "lucide-react";
import { CARD_COLOR_CLASSES, type CardColor } from "@/lib/riderContent";

const ICONS: Record<string, LucideIcon> = {
  clock: Clock,
  flame: Flame,
  shield: Shield,
  gift: Gift,
  info: Info,
  megaphone: Megaphone,
  zap: Zap,
  bike: Bike,
};

export default function RiderCardView({
  title,
  message,
  icon,
  color,
}: {
  title: string;
  message?: string;
  icon: string;
  color: string;
}) {
  const c = CARD_COLOR_CLASSES[color as CardColor] ?? CARD_COLOR_CLASSES.orange;
  const Icon = ICONS[icon] ?? Info;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${c.box}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${c.icon}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className={`text-sm font-bold ${c.title}`}>{title || "Title"}</p>
        {message ? <p className={`mt-1 whitespace-pre-line text-xs leading-relaxed ${c.text}`}>{message}</p> : null}
      </div>
    </div>
  );
}