import mongoose, { Schema, type Model } from "mongoose";

// Same collection ("supporttickets") the customer app and admin use.
// Rider tickets are marked userType "rider". The rider's uid is stored in
// clientUid and the rider's own messages use senderRole "client", so the
// admin screens work for both without changes to the message format.
export const TICKET_CATEGORIES = ["order", "payment", "ride", "technician", "app", "account", "other"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const RIDER_CATEGORIES = ["payment", "ride", "app", "account", "other"] as const;

export const TICKET_STATUSES = ["open", "in_progress", "fixed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const MAX_TICKET_MESSAGES = 200;

export interface ITicketMessage {
  senderRole: "client" | "admin";
  senderName: string;
  text: string;
  createdAt: Date;
}

export interface ISupportTicket {
  userType: "client" | "rider";
  clientUid: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  messages: ITicketMessage[];
  lastMessage: string;
  lastMessageAt: Date;
  unreadClient: number;
  unreadAdmin: number;
  fixedAt?: Date;
  fixedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<ITicketMessage>({
  senderRole: { type: String, enum: ["client", "admin"], required: true },
  senderName: { type: String, default: "" },
  text: { type: String, required: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
});

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    userType: { type: String, enum: ["client", "rider"], default: "client" },
    clientUid: { type: String, required: true },
    clientName: { type: String, default: "" },
    clientEmail: { type: String, default: "" },
    clientPhone: { type: String, default: "" },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    subject: { type: String, required: true, maxlength: 80 },
    status: { type: String, enum: TICKET_STATUSES, default: "open" },
    messages: { type: [MessageSchema], default: [] },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    unreadClient: { type: Number, default: 0 },
    unreadAdmin: { type: Number, default: 0 },
    fixedAt: { type: Date },
    fixedBy: { type: String },
  },
  { timestamps: true }
);

SupportTicketSchema.index({ clientUid: 1, lastMessageAt: -1 });
SupportTicketSchema.index({ status: 1, lastMessageAt: -1 });

const SupportTicket: Model<ISupportTicket> =
  (mongoose.models.SupportTicket as Model<ISupportTicket>) ||
  mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);

export default SupportTicket;