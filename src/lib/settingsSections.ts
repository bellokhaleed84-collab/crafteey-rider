export interface SettingsSection {
  slug: string;
  label: string;
  description: string;
  icon: string;
  core: boolean;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { slug: "availability", label: "Availability", description: "Control when you're visible for new delivery requests.", icon: "\uD83D\uDFE2", core: true },
  { slug: "delivery-requests", label: "Delivery requests", description: "Preferences for which jobs you see and accept.", icon: "\uD83D\uDCE6", core: true },
  { slug: "navigation", label: "Navigation", description: "Use in-app navigation or Google Maps.", icon: "\uD83E\uDDED", core: true },
  { slug: "payments", label: "Earnings & payments", description: "Payout method and earnings settings.", icon: "\uD83D\uDCB3", core: true },
  { slug: "safety", label: "Safety center", description: "Emergency assistance and safety tools.", icon: "\uD83D\uDEDF", core: true },

  { slug: "profile", label: "Profile", description: "Your name, phone, and account details.", icon: "\uD83E\uDDD1", core: false },
  { slug: "vehicle", label: "Vehicle & delivery details", description: "Vehicle type, plate, and ID information.", icon: "\uD83C\uDFCD\uFE0F", core: false },
  { slug: "notifications", label: "Notifications", description: "Manage alerts for new requests and updates.", icon: "\uD83D\uDD14", core: false },
  { slug: "communication", label: "Communication with customers", description: "How you contact clients during a delivery.", icon: "\uD83D\uDCAC", core: false },
  { slug: "privacy", label: "Privacy & security", description: "Manage your data and account security.", icon: "\uD83D\uDD12", core: false },
  { slug: "appearance", label: "Appearance", description: "Theme and display preferences.", icon: "\uD83C\uDFA8", core: false },
  { slug: "help", label: "Help & support", description: "Get help or contact support.", icon: "\u2753", core: false },
  { slug: "promotions", label: "Promotions & referrals", description: "Bonuses, referral codes, and offers.", icon: "\uD83C\uDF81", core: false },
  { slug: "legal", label: "Terms & conditions", description: "Rider terms of service and policies.", icon: "\uD83D\uDCC4", core: false },
  { slug: "about", label: "About", description: "App version and information.", icon: "\u2139\uFE0F", core: false },
];

export function getSettingsSection(slug: string) {
  return SETTINGS_SECTIONS.find((s) => s.slug === slug);
}