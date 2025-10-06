const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim");

const VehicleClassificationSchema = new Schema(
  {
    organizationId: {
      type: Types.ObjectId,
      ref: "Organization",
      required: false,
      default: null,
    },
    returnMileageThreshold: {
      type: Number,
      default: 0,
      min: 0,
    },
    ratePerMile: {
      type: Number,
      default: 0,
      min: 0,
    },
    isSystemDefault: {
      type: Boolean,
      default: function () {
        return this.organizationId === null;
      },
    },
    statesSpecific: [
      {
        state: {
          type: String,
          required: true,
        },
        returnMileageThreshold: {
          type: Number,
          default: 0,
          min: 0,
        },
        ratePerMile: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Create indexes for better query performance
VehicleClassificationSchema.index({ organizationId: 1 });
VehicleClassificationSchema.index({ "statesSpecific.state": 1 });
VehicleClassificationSchema.index({ isSystemDefault: 1 });

// Add pagination plugin
VehicleClassificationSchema.plugin(mongoosePaginate);

// Add trim plugin
VehicleClassificationSchema.plugin(trimStringsPlugin);

// Export using the utility function
module.exports = getOrCreateModel(
  "VehicleClassification",
  VehicleClassificationSchema
);
