"use client";

import { useParams } from "next/navigation";
import type { ComponentType } from "react";
import { findMenuItem } from "@/lib/settingsMenu";
import SettingsPageShell from "@/components/settings/SettingsPageShell";
import ExtraSection from "@/components/settings/ExtraSection";

import NavigationSection from "@/components/settings/Navigationsection";
import PaymentsSection from "@/components/settings/PaymentsSection";
import SafetySection from "@/components/settings/SafetySection";
import ProfileSection from "@/components/settings/ProfileSection";
import VehicleSection from "@/components/settings/VehicleSection";
import PrivacySection from "@/components/settings/PrivacySection";
import AppearanceSection from "@/components/settings/AppearanceSection";
import HelpSection from "@/components/settings/HelpSection";
import PromotionsSection from "@/components/settings/PromotionsSection";
import LegalSection from "@/components/settings/LegalSection";
import AboutSection from "@/components/settings/AboutSection";

// Keyed by slug - must match SETTINGS_MENU in lib/settingsMenu.ts (profile is opened from the top card).
const SECTION_COMPONENTS: Record<string, ComponentType> = {
  navigation: NavigationSection,
  payments: PaymentsSection,
  safety: SafetySection,
  profile: ProfileSection,
  vehicle: VehicleSection,
  privacy: PrivacySection,
  appearance: AppearanceSection,
  help: HelpSection,
  promotions: PromotionsSection,
  legal: LegalSection,
  about: AboutSection,
};

export default function SettingsDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const Section = SECTION_COMPONENTS[slug];
  const title = slug === "profile" ? "Profile" : findMenuItem(slug)?.label;

  // Not a built-in section: it may be one the admin added.
  if (!Section || !title) return <ExtraSection slug={slug} />;

  return (
    <SettingsPageShell title={title}>
      <Section />
    </SettingsPageShell>
  );
}