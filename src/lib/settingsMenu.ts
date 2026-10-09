export type MenuItem = { slug: string; label: string; description: string; icon: string };
export type MenuGroup = { title: string; items: MenuItem[] };

export const SETTINGS_MENU: MenuGroup[] = [
  {
    title: "Work",
    items: [
      { slug: "navigation", label: "Navigation", description: "In-app or Google Maps", icon: "\uD83E\uDDED" },
      { slug: "vehicle", label: "Vehicle details", description: "Your vehicle and plate number", icon: "\uD83C\uDFCD\uFE0F" },
      { slug: "payments", label: "Earnings & payments", description: "Money in, money out, payout account", icon: "\uD83D\uDCB0" },
    ],
  },
  {
    title: "Safety & support",
    items: [
      { slug: "safety", label: "Safety centre", description: "Emergency numbers and safety tips", icon: "\uD83D\uDEE1\uFE0F" },
      { slug: "privacy", label: "Privacy & security", description: "Your data and your account", icon: "\uD83D\uDD12" },
      { slug: "help", label: "Help & support", description: "Answers and contact", icon: "\uD83D\uDCAC" },
    ],
  },
  {
    title: "App",
    items: [
      { slug: "appearance", label: "Appearance", description: "Light, dark or match your phone", icon: "\uD83C\uDF19" },
      { slug: "promotions", label: "Promotions", description: "Offers and referrals", icon: "\uD83C\uDF81" },
      { slug: "legal", label: "Terms & conditions", description: "The rules for riders", icon: "\uD83D\uDCC4" },
      { slug: "about", label: "About", description: "Version and info", icon: "\u2139\uFE0F" },
    ],
  },
];

export function findMenuItem(slug: string): MenuItem | undefined {
  for (const g of SETTINGS_MENU) {
    const hit = g.items.find((i) => i.slug === slug);
    if (hit) return hit;
  }
  return undefined;
}