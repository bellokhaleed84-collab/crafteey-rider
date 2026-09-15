// Mirrors crafteey-client's COURIER_STATUS exactly — both apps read and
// write the same CourierRequest documents in the same MongoDB database,
// so these values must stay in lockstep. If you ever change one, change
// the other.
export const COURIER_STATUS = {
  PENDING: "pending", // request posted, no courier yet
  ACCEPTED: "accepted", // courier accepted, contact info now revealed
  PICKED_UP: "picked_up",
  EN_ROUTE: "en_route",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const;

export type CourierStatus = (typeof COURIER_STATUS)[keyof typeof COURIER_STATUS];

// Courier account approval state — mirrors the technician portal's
// pending/approved/rejected pattern for consistency.
export const COURIER_ACCOUNT_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type CourierAccountStatus =
  (typeof COURIER_ACCOUNT_STATUS)[keyof typeof COURIER_ACCOUNT_STATUS];

export const VEHICLE_TYPES = ["Motorcycle", "Bicycle", "Car", "Van/Truck"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

// ---------------------------------------------------------------------
// Approval gate toggle (pre-launch testing)
//
// Set NEXT_PUBLIC_REQUIRE_COURIER_APPROVAL=false in .env.local to let new
// couriers go straight to the dashboard without waiting for an admin to
// approve them. Remove it (or set it to anything else) to restore the
// normal gated flow at launch.
//
// Defaults to TRUE — if the env var is missing on Vercel, the app fails
// closed (gated) rather than open.
// ---------------------------------------------------------------------
export const REQUIRE_COURIER_APPROVAL =
  process.env.NEXT_PUBLIC_REQUIRE_COURIER_APPROVAL !== "false";