import { COURIER_STATUS } from "@/lib/constants";

export type DestinationTarget = "pickup" | "dropoff";

export interface NavigationStage {
  statusLabel: string;
  nextActionLabel: string;
  destination: DestinationTarget;
  arrivedLabel: string;
}

// Single source of truth for "what does the map/route show and what does
// the action button say" given the delivery's current status. Previously
// this was scattered across two separate lookup objects plus an ad-hoc
// `status !== ACCEPTED` boolean — this makes status the one thing that
// drives navigation, per the plan.
export const NAVIGATION_STAGES: Record<string, NavigationStage> = {
  [COURIER_STATUS.ACCEPTED]: {
    statusLabel: "Heading to pickup",
    nextActionLabel: "Mark as picked up",
    destination: "pickup",
    arrivedLabel: "You've arrived at pickup",
  },
  [COURIER_STATUS.PICKED_UP]: {
    statusLabel: "Picked up",
    nextActionLabel: "Start heading to drop-off",
    destination: "dropoff",
    arrivedLabel: "Ready to head out",
  },
  [COURIER_STATUS.EN_ROUTE]: {
    statusLabel: "On the way to drop-off",
    nextActionLabel: "Mark as delivered",
    destination: "dropoff",
    arrivedLabel: "You've arrived at drop-off",
  },
};