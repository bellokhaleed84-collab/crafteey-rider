import mongoose, { Schema, type Model } from "mongoose";

export const REVIEW_TARGETS = ["company", "vendor", "rider"] as const;
export type ReviewTarget = (typeof REVIEW_TARGETS)[number];

// What the review is about: the thing that was completed.
export const REVIEW_SOURCES = ["company_job", "hub_order", "courier_request"] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

export const REVIEW_STATUSES = ["published", "hidden"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_COMMENT_MAX = 500;

export interface IReview {
  reviewerUid: string;
  reviewerName: string;
  targetType: ReviewTarget;
  targetId: string;
  targetName: string;
  sourceType: ReviewSource;
  sourceId: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  hiddenReason?: string;
  hiddenBy?: string;
  hiddenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    reviewerUid: { type: String, required: true, index: true },
    reviewerName: { type: String, default: "" },
    targetType: { type: String, enum: REVIEW_TARGETS, required: true },
    targetId: { type: String, required: true },
    targetName: { type: String, default: "" },
    sourceType: { type: String, enum: REVIEW_SOURCES, required: true },
    sourceId: { type: String, required: true },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: { validator: Number.isInteger, message: "Rating must be a whole number" },
    },
    comment: { type: String, default: "", maxlength: REVIEW_COMMENT_MAX },
    status: { type: String, enum: REVIEW_STATUSES, default: "published" },
    hiddenReason: { type: String, maxlength: 300 },
    hiddenBy: { type: String },
    hiddenAt: { type: Date },
  },
  { timestamps: true }
);

// One review per finished thing per target (a Hub order can have one vendor review and one rider review).
ReviewSchema.index({ sourceType: 1, sourceId: 1, targetType: 1 }, { unique: true });
ReviewSchema.index({ targetType: 1, targetId: 1, status: 1, createdAt: -1 });
ReviewSchema.index({ status: 1, createdAt: -1 });

const Review: Model<IReview> =
  (mongoose.models.Review as Model<IReview>) || mongoose.model<IReview>("Review", ReviewSchema);

export default Review;