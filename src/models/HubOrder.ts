import { Schema, models, model } from "mongoose";

// Minimal mirror of crafteey-client's HubOrder model. This app only ever
// updates `status` on an existing Hub order (to keep the client's order
// page in sync with courier progress) — it never creates or reads one in
// full, so most fields from the real schema are intentionally omitted.
// `strict: false` means Mongoose won't strip anything out on read, and
// since we only ever $set a single field via findOneAndUpdate, the
// missing `required` fields on the real schema never get validated here.
// Points at the same "huborders" collection via Mongoose's default
// pluralization of the model name "HubOrder", matching crafteey-client.
const HubOrderSchema = new Schema(
  {
    status: { type: String },
  },
  { timestamps: true, strict: false }
);

export default models.HubOrder || model("HubOrder", HubOrderSchema);