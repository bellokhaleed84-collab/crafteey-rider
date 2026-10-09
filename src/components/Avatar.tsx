import { User } from "lucide-react";
import { AVATARS } from "@/lib/avatars";

// Round avatar. If the rider has not picked one yet, shows the old yellow icon.
export default function Avatar({
  avatarId,
  className = "h-14 w-14",
}: {
  avatarId?: string | null;
  className?: string;
}) {
  const a = AVATARS.find((x) => x.id === avatarId);

  if (!a) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sunshine text-brand ${className}`}
      >
        <User className="h-1/2 w-1/2" />
      </span>
    );
  }

  const ink = "#1F2430";

  return (
    <span className={`block shrink-0 overflow-hidden rounded-full ${className}`}>
      <svg viewBox="0 0 100 100" className="block h-full w-full" aria-hidden="true">
        <rect width="100" height="100" fill={a.bg} />

        {/* Hair behind the head */}
        {a.hair === "afro" && <circle cx="50" cy="36" r="27" fill={a.hairColor} />}
        {a.hair === "long" && <ellipse cx="50" cy="48" rx="23" ry="30" fill={a.hairColor} />}
        {a.hair === "braids" && (
          <g stroke={a.hairColor} strokeWidth="6" strokeLinecap="round" fill="none">
            <path d="M32 40 V74" />
            <path d="M68 40 V74" />
            <path d="M38 36 V70" />
            <path d="M62 36 V70" />
          </g>
        )}

        {/* Shoulders, neck, head */}
        <path d="M16 100 C16 76 32 68 50 68 C68 68 84 76 84 100 Z" fill={a.shirt} />
        <rect x="44" y="58" width="12" height="14" rx="4" fill={a.skin} />
        <ellipse cx="50" cy="44" rx="17" ry="19" fill={a.skin} />

        {a.beard && (
          <path
            d="M33 50 C33 66 41 70 50 70 C59 70 67 66 67 50 C63 58 58 60 50 60 C42 60 37 58 33 50 Z"
            fill={a.hairColor}
          />
        )}

        {/* Hair, caps and helmets in front */}
        {(a.hair === "short" || a.hair === "long" || a.hair === "braids") && (
          <path
            d="M32 42 C30 24 42 21 50 21 C58 21 70 24 68 42 C64 33 58 30 50 30 C42 30 36 33 32 42 Z"
            fill={a.hairColor}
          />
        )}
        {a.hair === "cap" && (
          <g fill={a.accent}>
            <path d="M32 36 C31 20 41 16 50 16 C59 16 69 20 68 36 Z" />
            <path d="M30 35 H76 Q77 40 70 40 H30 Z" />
          </g>
        )}
        {a.hair === "helmet" && (
          <g>
            <path d="M31 40 C28 18 40 13 50 13 C60 13 72 18 69 40 Z" fill={a.accent} />
            <rect x="29" y="38" width="42" height="4" rx="2" fill={ink} opacity="0.35" />
            <ellipse cx="42" cy="22" rx="6" ry="3" fill="#FFFFFF" opacity="0.35" />
          </g>
        )}
        {a.hair === "wrap" && (
          <g fill={a.accent}>
            <path d="M31 38 C29 22 40 15 50 15 C60 15 71 22 69 38 C62 32 38 32 31 38 Z" />
            <circle cx="66" cy="17" r="8" />
            <path d="M33 31 C42 26 58 26 67 31" stroke="#FFFFFF" strokeWidth="2" opacity="0.45" fill="none" />
          </g>
        )}

        {/* Face */}
        <circle cx="43" cy="47" r="2" fill={ink} />
        <circle cx="57" cy="47" r="2" fill={ink} />
        <path d="M43 56 Q50 62 57 56" stroke={ink} strokeWidth="2" strokeLinecap="round" fill="none" />

        {a.glasses && (
          <g fill="none" stroke={ink} strokeWidth="1.6">
            <circle cx="43" cy="47" r="5.5" />
            <circle cx="57" cy="47" r="5.5" />
            <path d="M48.5 47 H51.5" />
          </g>
        )}
      </svg>
    </span>
  );
}