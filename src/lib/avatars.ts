export type HairStyle = "short" | "afro" | "bald" | "long" | "cap" | "helmet" | "braids" | "wrap";

export interface AvatarDef {
  id: string;
  bg: string;
  skin: string;
  shirt: string;
  hair: HairStyle;
  hairColor: string;
  accent: string;
  beard?: boolean;
  glasses?: boolean;
}

// The 10 avatars riders can choose from. The id is what gets saved.
export const AVATARS: AvatarDef[] = [
  { id: "a1", bg: "#FDE68A", skin: "#8D5A3B", shirt: "#F5C518", hair: "short", hairColor: "#1F2430", accent: "#1F2430" },
  { id: "a2", bg: "#CFE8FF", skin: "#5A3825", shirt: "#F97316", hair: "afro", hairColor: "#15181F", accent: "#15181F" },
  { id: "a3", bg: "#FDE68A", skin: "#A86B4A", shirt: "#2563EB", hair: "cap", hairColor: "#15181F", accent: "#15181F", beard: true },
  { id: "a4", bg: "#E2E8F0", skin: "#7A4A2E", shirt: "#15181F", hair: "helmet", hairColor: "#15181F", accent: "#F97316" },
  { id: "a5", bg: "#FCE7F3", skin: "#6B4129", shirt: "#7C3AED", hair: "wrap", hairColor: "#15181F", accent: "#DB2777" },
  { id: "a6", bg: "#D1FAE5", skin: "#C68642", shirt: "#10B981", hair: "long", hairColor: "#2B1B12", accent: "#2B1B12" },
  { id: "a7", bg: "#EDE9FE", skin: "#4A2F1E", shirt: "#F59E0B", hair: "braids", hairColor: "#15181F", accent: "#15181F" },
  { id: "a8", bg: "#E0F2FE", skin: "#8D5A3B", shirt: "#EF4444", hair: "bald", hairColor: "#15181F", accent: "#15181F", beard: true, glasses: true },
  { id: "a9", bg: "#FEE2E2", skin: "#C68642", shirt: "#F5C518", hair: "helmet", hairColor: "#15181F", accent: "#2563EB", glasses: true },
  { id: "a10", bg: "#D1FAE5", skin: "#E0AC69", shirt: "#15181F", hair: "short", hairColor: "#5A3825", accent: "#5A3825", glasses: true },
];

export const AVATAR_IDS: string[] = AVATARS.map((a) => a.id);