import { Schema, models, model } from "mongoose";
import { COURIER_ACCOUNT_STATUS, VEHICLE_TYPES } from "@/lib/constants";

// New collection — courier accounts. Mirrors the technician portal's
// registration/approval shape (assumption: couriers self-register, then
// an admin approves them, same trust model as technicians. Flag if you
// want a different onboarding flow, e.g. invite-only).
const CourierSchema = new Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },

    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    vehiclePlate: { type: String, default: "" },

    // Same NIN/ID verification pattern as the technician portal.
    idNumber: { type: String, default: "" },
    idPhotoUrl: { type: String, default: "" },

    status: {
      type: String,
      enum: Object.values(COURIER_ACCOUNT_STATUS),
      default: COURIER_ACCOUNT_STATUS.PENDING,
      index: true,
    },

    // Set true only while the courier has the app open and location
    // sharing enabled — used to decide whether to surface them for new
    // request matching.
    isOnline: { type: Boolean, default: false },
    currentLocation: {
      type: new Schema({ lat: Number, lng: Number }, { _id: false }),
      default: null,
    },
  },
  { timestamps: true }
);

export default models.Courier || model("Courier", CourierSchema);