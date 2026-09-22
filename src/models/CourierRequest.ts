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

    status: {
      type: String,
      enum: Object.values(COURIER_STATUS),
      default: COURIER_STATUS.PENDING,
      index: true,
    },

    // Riders who let this request time out or explicitly declined it —
    // excluded from seeing it again in their own queue, but it stays
    // open and visible to every other matching rider until someone
    // accepts it or it's declined by everyone eligible.
    declinedBy: { type: [String], default: [] },

    // Populated once a courier accepts.
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