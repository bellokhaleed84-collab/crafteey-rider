import { Schema, models, model } from "mongoose";

// A rider's request to change vehicle. Stays "pending" until an admin
// approves it; approval then updates the Courier's vehicleType and plate.
const VehicleChangeRequestSchema = new Schema(
  {
    courierUid: { type: String, required: true, index: true },
    fromVehicleType: { type: String, default: "" },
    vehicleType: { type: String, enum: ["bicycle", "motorcycle"], required: true },
    plate: { type: String, default: "" },
    photoDataUrl: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    adminNote: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export default models.VehicleChangeRequest || model("VehicleChangeRequest", VehicleChangeRequestSchema);