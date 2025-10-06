const mongoose = require("mongoose");
const { Schema } = mongoose;
const trimStringsPlugin = require("../../utils/trim")

const DriverPortalSettingsSchema = new Schema(
  {
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    urlPath: {
      type: String,
      required: true,
      trim: true,
    },
    subscriptionCost: {
      type: Number,
      required: true,
      default: 9.99,
    },
    oneTimeCost: {
      type: Number,
      required: true,
      default: 25,
    },
    paymentType: {
      type: String,
      enum: ["percentage", "flat"],
      required: true,
      default: "percentage",
    },
    percentageValue: {
      type: Number,
      required: function () {
        return this.paymentType === "percentage";
      },
      default: 20,
    },
    flatFeeValue: {
      type: Number,
      required: function () {
        return this.paymentType === "flat";
      },
      default: 8,
    },
    stripeConnected: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

DriverPortalSettingsSchema.plugin(trimStringsPlugin)

module.exports = mongoose.model(
  "DriverPortalSettings",
  DriverPortalSettingsSchema
);
