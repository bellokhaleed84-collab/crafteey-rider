import { Schema, models, model } from "mongoose";

// Delivery chat between the client and the assigned courier.
// Identical copy in crafteey-client and crafteey-rider.
const ChatMessageSchema = new Schema(
  {
    requestId: { type: String, required: true, index: true },
    senderUid: { type: String, required: true },
    senderRole: { type: String, enum: ["client", "courier"], required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

ChatMessageSchema.index({ requestId: 1, createdAt: 1 });

export default models.ChatMessage || model("ChatMessage", ChatMessageSchema);