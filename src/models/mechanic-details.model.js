const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim");

const MechanicDetailsSchema = new Schema(
  {
    mechanicId: {
      type: Types.ObjectId,
      ref: "Mechanic",
      required: true,
    },
    details: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: Types.ObjectId,
      ref: "Users",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for better performance
MechanicDetailsSchema.index({ mechanicId: 1 });
MechanicDetailsSchema.index({ createdBy: 1 });
MechanicDetailsSchema.index({ mechanicId: 1, createdAt: -1 });

// Add pagination plugin
MechanicDetailsSchema.plugin(mongoosePaginate);

// Add trim plugin
MechanicDetailsSchema.plugin(trimStringsPlugin);

// Export using the utility function
module.exports = getOrCreateModel("MechanicDetails", MechanicDetailsSchema);
