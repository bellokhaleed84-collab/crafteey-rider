import { Schema, models, model } from "mongoose";

// Reports from riders: an emergency alert, a job given back before pickup, or
// a delivery locked after too many wrong delivery codes. Saved with a snapshot
// of the delivery so an admin can read it without looking anything else up.
// "problem" is no longer created (Report a problem now shows solutions instead).
// Note: crafteey-admin has its own copy of this file.
export const REPORT_KINDS = ["problem", "emergency", "gave_up", "locked"] as const;

const DeliveryReportSchema = new Schema(
  {
    kind: { type: String, enum: REPORT_KINDS, required: true, index: true },
    requestId: { type: String, required: true, index: true },
    courierUid: { type: String, required: true, index: true },
    courierName: { type: String, default: "" },
    courierPhone: { type: String, default: "" },

    clientName: { type: String, default: "" },
    pickup: { type: String, default: "" },
    dropoff: { type: String, default: "" },
    source: { type: String, default: "direct" },
    orderNumber: { type: String, default: null },

    reason: { type: String, default: "" },
    note: { type: String, default: "" },
    location: {
      type: new Schema({ lat: Number, lng: Number }, { _id: false }),
      default: null,
    },

    status: { type: String, enum: ["open", "resolved"], default: "open", index: true },
  },
  { timestamps: true }
);

export default models.DeliveryReport || model("DeliveryReport", DeliveryReportSchema);