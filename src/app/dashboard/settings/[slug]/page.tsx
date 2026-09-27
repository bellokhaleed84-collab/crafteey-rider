"use client";

import { useParams } from "next/navigation";
import type { ComponentType } from "react";
import { getSettingsSection } from "@/lib/settingsSections";
import SettingsPageShell from "@/components/settings/SettingsPageShell";

import AvailabilitySection from "@/components/settings/Availabilitysection";
import DeliveryRequestsSection from "@/components/settings/Deliveryrequestssection";
import NavigationSection from "@/components/settings/Navigationsection";
import PaymentsSection from "@/components/settings/PaymentsSection";
import SafetySection from "@/components/settings/SafetySection";
import ProfileSection from "@/components/settings/ProfileSection";
import VehicleSection from "@/components/settings/VehicleSection";
import NotificationsSection from "@/components/settings/NotificationsSection";
import CommunicationSection from "@/components/settings/CommunicationSection";
import PrivacySection from "@/components/settings/PrivacySection";
import AppearanceSection from "@/components/settings/AppearanceSection";
import HelpSection from "@/components/settings/HelpSection";
import PromotionsSection from "@/components/settings/PromotionsSection";
import LegalSection from "@/components/settings/LegalSection";
import AboutSection from "@/components/settings/AboutSection";

// Keyed by slug — must match SETTINGS_SECTIONS in lib/settingsSections.ts.
const SECTION_COMPONENTS: Record<string, ComponentType> = {
  availability: AvailabilitySection,
  "delivery-requests": DeliveryRequestsSection,
  navigation: NavigationSection,
  payments: PaymentsSection,
  safety: SafetySection,
  profile: ProfileSection,
  vehicle: VehicleSection,
  notifications: NotificationsSection,
  communication: CommunicationSection,
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
  const meta = getSettingsSection(slug);
  const Section = SECTION_COMPONENTS[slug];

  if (!meta || !Section) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-brand">Not found</h1>
        <p className="text-sm text-steel">This settings page doesn't exist.</p>
      </div>
    );
  }

  return (
    <SettingsPageShell title={meta.label}>
      <Section />
    </SettingsPageShell>
  );
}