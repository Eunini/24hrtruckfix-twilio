const mongoose = require("mongoose");
const { Schema } = mongoose;

// Meeting schema
const meetingSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    organizationId: {
      type: String,
      trim: true,
    },
    mechanicId: {
      type: String,
      trim: true,
    },
    callId: {
      type: String,
      required: true,
    },
    attendees: [
      {
        type: String,
      },
    ],
    description: {
      type: String,
      trim: true,
    },
    eventId: {
      type: String,
      trim: true,
    },
    timeZoneId: {
      type: String,
      required: true,
      default: "UTC",
    },
    provider: {
      type: String,
      enum: ["google", "outlook"],
      default: "google", // Default to google for backward compatibility
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Validation to ensure either organizationId or mechanicId is provided
meetingSchema.pre("save", function (next) {
  if (!this.organizationId && !this.mechanicId) {
    const error = new Error(
      "Either organizationId or mechanicId must be provided"
    );
    return next(error);
  }
  next();
});

// Create indexes for more efficient queries
meetingSchema.index({ eventId: 1, provider: 1 });
meetingSchema.index({ organizationId: 1 });
meetingSchema.index({ mechanicId: 1 });
meetingSchema.index({ startTime: 1, endTime: 1 });

// Create and export the model
const Meeting = mongoose.model("Meeting", meetingSchema);
module.exports = Meeting;
