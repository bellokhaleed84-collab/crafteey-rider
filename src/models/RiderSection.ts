import mongoose, { Schema, type Model } from "mongoose";

// Same "ridersections" collection the admin edits. Field names must match crafteey-admin.
export interface IRiderSection {
  slug: string;
  title: string;
  description: string;
  icon: string;
  group: string;
  body: string;
  order: number;
  enabled: boolean;
}

const RiderSectionSchema = new Schema<IRiderSection>(
  {
    slug: String,
    title: String,
    description: String,
    icon: String,
    group: String,
    body: String,
    order: Number,
    enabled: Boolean,
  },
  { timestamps: true, autoIndex: false }
);

const RiderSection: Model<IRiderSection> =
  (mongoose.models.RiderSection as Model<IRiderSection>) ||
  mongoose.model<IRiderSection>("RiderSection", RiderSectionSchema);

export default RiderSection;