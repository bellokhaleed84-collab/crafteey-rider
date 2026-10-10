import { Schema, models, model } from "mongoose";
import { COURIER_STATUS, VEHICLE_TYPES } from "@/lib/constants";

// This file is an identical copy in crafteey-client and crafteey-rider.
// Keep both copies the same.
export const PAYMENT_METHODS = ["cash", "transfer"] as const;
export const PAYMENT_STATUSES = ["unpaid", "client_marked_paid", "collected"] as const;

const CourierRequestSchema = new Schema(
  {
    clientUid: { type: String, required: true, index: true },
    clientName: { type: String, required: true },
    clientPhone: { type: String, required: true },

    pickup: { type: String, required: true },
    dropoff: { type: String, required: true },
    pickupLat: { type: Number, default: null },
    pickupLng: { type: Number, default: null },
    dropoffLat: { type: Number, default: null },
    dropoffLng: { type: Number, default: null },

    receiverName: { type: String, default: "" },
    receiverPhone: { type: String, default: "" },
    pickupContactName: { type: String, default: "" },
    pickupContactPhone: { type: String, default: "" },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true, index: true },

    note: { type: String, default: "" },

    // All money fields are in kobo.
    // Full delivery fee the customer pays (direct rides only).
    totalFeeKobo: { type: Number, default: null },
    // Rider's share of the fee.
    riderEarningKobo: { type: Number, default: null },
    // Platform cut. For direct rides this becomes rider debt on delivery.
    platformCommissionKobo: { type: Number, default: null },
    // Guards against settling earnings twice.
    earningsSettled: { type: Boolean, default: false },

    // Direct rides: how the customer pays the rider.
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "unpaid" },
    clientMarkedPaidAt: { type: Date, default: null },
    paymentCollectedAt: { type: Date, default: null },

    source: { type: String, enum: ["direct", "hub"], default: "direct", index: true },
    hubOrderId: { type: String, default: null, index: true },
    orderNumber: { type: String, default: null },
    vendorName: { type: String, default: "" },
    pickupCode: { type: String, default: null },

    // Delivery code: a 4-digit code the customer gives the receiver. The rider
    // must type it to finish the delivery. Always on for Hub orders; direct
    // rides switch it on when booking. The code itself is never sent to rider apps.
    deliveryCodeRequired: { type: Boolean, default: false },
    deliveryCode: { type: String, default: null },
    deliveryCodeAttempts: { type: Number, default: 0 },
    deliveryCodeVerifiedAt: { type: Date, default: null },

    status: {
      type: String,
      enum: Object.values(COURIER_STATUS),
      default: COURIER_STATUS.PENDING,
      index: true,
    },

    declinedBy: { type: [String], default: [] },

    courierUid: { type: String, default: null, index: true },
    courierName: { type: String, default: null },
    courierPhone: { type: String, default: null },
    courierLocation: {
      type: new Schema({ lat: Number, lng: Number }, { _id: false }),
      default: null,
    },

    acceptedAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default models.CourierRequest ||
  model("CourierRequest", CourierRequestSchema);