const mongoose = require("mongoose");
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim")

const DriverVerificationSchema = new Schema(
  {
    driverId: {
      type: Types.ObjectId,
      ref: "Driver",
      required: true,
    },
    organizationId: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending_review", "approved", "rejected", "resubmission_required"],
      default: "pending_review",
    },
    documents: {
      driverLicenseFront: {
        filename: String,
        originalName: String,
        mimeType: String,
        size: Number,
        uploadDate: { type: Date, default: Date.now },
        path: String, // File storage path
      },
      driverLicenseBack: {
        filename: String,
        originalName: String,
        mimeType: String,
        size: Number,
        uploadDate: { type: Date, default: Date.now },
        path: String, // File storage path
      },
    },
    documentsReceived: [
      {
        type: String,
        enum: ["front", "back"],
      },
    ],
    reviewedBy: {
      type: Types.ObjectId,
      ref: "Users", // Admin/reviewer who processed this
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
      trim: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    submissionCount: {
      type: Number,
      default: 1,
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      submissionSource: {
        type: String,
        default: "driver_portal",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
DriverVerificationSchema.index({ driverId: 1 });
DriverVerificationSchema.index({ status: 1 });
DriverVerificationSchema.index({ organizationId: 1 });

DriverVerificationSchema.plugin(trimStringsPlugin);

// Update the updatedAt field before save
DriverVerificationSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = getOrCreateModel(
  "DriverVerification",
  DriverVerificationSchema
);
