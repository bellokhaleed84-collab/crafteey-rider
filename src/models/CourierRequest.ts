import { Schema, models, model } from "mongoose";
import { COURIER_STATUS, VEHICLE_TYPES } from "@/lib/constants";

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

    // New — distinguishes a Hub-order-triggered request from a direct
    // Rides booking, and carries what a Hub pickup needs that a direct
    // booking doesn't.
    source: { type: String, enum: ["direct", "hub"], default: "direct", index: true },
    hubOrderId: { type: String, default: null, index: true },
    vendorName: { type: String, default: "" },
    pickupCode: { type: String, default: null },

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
  },
  { timestamps: true }
);

export default models.CourierRequest ||
  model("CourierRequest", CourierRequestSchema);