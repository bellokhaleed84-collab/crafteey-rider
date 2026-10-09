import { Schema, models, model } from "mongoose";
import { COURIER_ACCOUNT_STATUS, VEHICLE_TYPES } from "@/lib/constants";
import { ID_TYPES } from "@/lib/riderSignup";

// Courier accounts. Couriers self-register, then an admin approves them,
// same trust model as technicians.
const CourierSchema = new Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: "" },
    // YYYY-MM-DD
    dateOfBirth: { type: String, default: "" },

    // Which of the 10 built-in avatars the rider picked ("a1" to "a10").
    // Empty means none picked yet.
    avatarId: { type: String, default: "" },

    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    vehicleBrand: { type: String, default: "" },
    vehicleModel: { type: String, default: "" },
    vehicleColor: { type: String, default: "" },
    vehiclePlate: { type: String, default: "" },

    // Document verification (NIN, driver's licence or voter's card).
    idType: { type: String, enum: ["", ...ID_TYPES], default: "" },
    idNumber: { type: String, default: "" },
    idPhotoUrl: { type: String, default: "" },

    status: {
      type: String,
      enum: Object.values(COURIER_ACCOUNT_STATUS),
      default: COURIER_ACCOUNT_STATUS.PENDING,
      index: true,
    },

    // Set true only while the courier has the app open and location
    // sharing enabled - used to decide whether to surface them for new
    // request matching.
    isOnline: { type: Boolean, default: false },
    currentLocation: {
      type: new Schema({ lat: Number, lng: Number }, { _id: false }),
      default: null,
    },

    // Earnings system -
    // Direct Rides bookings: rider collects the full fare in cash from
    // the client, so the platform's 20% commission accumulates here as
    // a debt owed back to Crafteey rather than being deducted upfront.
    debtKobo: { type: Number, default: 0 },
    // Hub orders: client already paid in-app, so the rider's 80% share
    // accumulates here until the next Mon/Thu payout batch.
    walletBalanceKobo: { type: Number, default: 0 },
    // All-time total ever earned (Hub only, since direct-ride earnings
    // are cash the rider already has in hand) - never decreases, even
    // after a payout zeroes walletBalanceKobo.
    lifetimeEarningsKobo: { type: Number, default: 0 },

    // True once debtKobo goes strictly above the threshold. Blocks going
    // online / accepting new work; does not interrupt a delivery already
    // in progress.
    accountSuspended: { type: Boolean, default: false },
    // Prevents the daily debt-alert cron from emailing the same courier
    // more than once in a day.
    lastDebtAlertSentAt: { type: Date, default: null },

    // Payout destination for the Mon/Thu wallet withdrawal and for
    // Paystack Transfer Recipient creation.
    bankCode: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    accountName: { type: String, default: "" },
    paystackRecipientCode: { type: String, default: "" },
  },
  { timestamps: true }
);

export default models.Courier || model("Courier", CourierSchema);