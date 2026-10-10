import { Schema, models, model } from "mongoose";

// Reports from riders: a problem on a delivery, an emergency alert, or a job
// given back before pickup. Saved with a snapshot of the delivery so an admin
// can read it without looking anything else up.
// Note: crafteey-admin needs its own copy of this file to show these.
export const REPORT_KINDS = ["problem", "emergency", "gave_up"] as const;

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