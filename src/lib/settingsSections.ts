export interface SettingsSection {
  slug: string;
  label: string;
  description: string;
  icon: string;
  core: boolean;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { slug: "availability", label: "Availability", description: "Control when you're visible for new delivery requests.", icon: "🟢", core: true },
  { slug: "delivery-requests", label: "Delivery requests", description: "Preferences for which jobs you see and accept.", icon: "📦", core: true },
  { slug: "navigation", label: "Navigation", description: "Choose how you get directions to pickups and drop-offs.", icon: "🧭", core: true },
  { slug: "payments", label: "Earnings & payments", description: "Payout method and earnings settings.", icon: "💳", core: true },
  { slug: "safety", label: "Safety center", description: "Emergency assistance and safety tools.", icon: "🛟", core: true },

  { slug: "profile", label: "Profile", description: "Your name, phone, and account details.", icon: "🧑", core: false },
  { slug: "vehicle", label: "Vehicle & delivery details", description: "Vehicle type, plate, and ID information.", icon: "🏍️", core: false },
  { slug: "notifications", label: "Notifications", description: "Manage alerts for new requests and updates.", icon: "🔔", core: false },
  { slug: "communication", label: "Communication with customers", description: "How you contact clients during a delivery.", icon: "💬", core: false },
  { slug: "privacy", label: "Privacy & security", description: "Manage your data and account security.", icon: "🔒", core: false },
  { slug: "appearance", label: "Appearance", description: "Theme and display preferences.", icon: "🎨", core: false },
  { slug: "help", label: "Help & support", description: "Get help or contact support.", icon: "❓", core: false },
  { slug: "promotions", label: "Promotions & referrals", description: "Bonuses, referral codes, and offers.", icon: "🎁", core: false },
  { slug: "legal", label: "Legal", description: "Terms of service and policies.", icon: "📄", core: false },
  { slug: "about", label: "About", description: "App version and information.", icon: "ℹ️", core: false },
];

export function getSettingsSection(slug: string) {
  return SETTINGS_SECTIONS.find((s) => s.slug === slug);
}