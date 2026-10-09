import mongoose, { Schema, type Model } from "mongoose";

// Same "riderhomecards" collection the admin edits. Field names must match crafteey-admin.
export interface IRiderHomeCard {
  title: string;
  message: string;
  icon: string;
  color: string;
  order: number;
  enabled: boolean;
  schedule: { always: boolean; days: number[]; start: string; end: string };
  startsAt?: Date | null;
  endsAt?: Date | null;
}

const RiderHomeCardSchema = new Schema<IRiderHomeCard>(
  {
    title: String,
    message: String,
    icon: String,
    color: String,
    order: Number,
    enabled: Boolean,
    schedule: { always: Boolean, days: [Number], start: String, end: String },
    startsAt: Date,
    endsAt: Date,
  },
  { timestamps: true, autoIndex: false }
);

const RiderHomeCard: Model<IRiderHomeCard> =
  (mongoose.models.RiderHomeCard as Model<IRiderHomeCard>) ||
  mongoose.model<IRiderHomeCard>("RiderHomeCard", RiderHomeCardSchema);

export default RiderHomeCard;