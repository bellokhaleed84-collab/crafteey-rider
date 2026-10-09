import mongoose, { Schema, type Model } from "mongoose";

// Same "legaldocuments" collection the admin edits. The rider app only reads it.
export interface ILegalDocument {
  slug: string;
  body: string;
  version: number;
}

const LegalDocumentSchema = new Schema<ILegalDocument>(
  { slug: String, body: String, version: Number },
  { timestamps: true, autoIndex: false }
);

const LegalDocument: Model<ILegalDocument> =
  (mongoose.models.LegalDocument as Model<ILegalDocument>) ||
  mongoose.model<ILegalDocument>("LegalDocument", LegalDocumentSchema);

export default LegalDocument;