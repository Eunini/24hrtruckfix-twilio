const mongoose = require("mongoose");
const { Schema } = mongoose;
const trimStringsPlugin = require("../../utils/trim");

const mechanicsQueueSchema = new Schema(
  {
    ticketId: {
      type: String,
      required: true,
      index: true,
    },
    internationalPhoneNumber: {
      type: String,
      required: true,
    },
    formattedAddress: {
      type: String,
      required: true,
    },
    displayName: {
      text: {
        type: String,
        required: true,
      },
      languageCode: {
        type: String,
        default: "en",
      },
    },
    hasOnboarded: {
      type: Boolean,
      default: false,
    },
    firstName: {
      type: String,
      default: "",
    },
    labour: {
      type: String,
      default: "",
    },
    distance: {
      type: Number, // Distance from breakdown location
    },
    source: {
      type: String,
      enum: ["database", "google"],
      required: true,
    },
  },
  {
    timestamps: true,
    strict: false, // Allow additional fields
  }
);

mechanicsQueueSchema.plugin(trimStringsPlugin);
// Add compound indexes for performance
mechanicsQueueSchema.index(
  { ticketId: 1, internationalPhoneNumber: 1 },
  { unique: true }
);
mechanicsQueueSchema.index({ ticketId: 1, createdAt: -1 });

module.exports = mongoose.model("MechanicsQueue", mechanicsQueueSchema);
