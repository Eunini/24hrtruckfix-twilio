const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { Schema } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim");

const allowedWeights = ["light_duty", "medium_duty", "heavy_duty"];

const WeightClassificationSchema = new Schema(
  {
    weight_classification: {
      type: String,
      required: true,
      enum: allowedWeights,
    },
    price: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const StateSpecificSchema = new Schema(
  {
    state: {
      type: String,
      required: true,
    },
    weight_classification: {
      type: [WeightClassificationSchema],
      required: true,
      validate: (v) => Array.isArray(v),
    },
  },
  { _id: false }
);

const ServiceSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    isSystemService: {
      type: Boolean,
      default: function () {
        return this.organization === null;
      },
    },
    weight_classification: {
      type: [WeightClassificationSchema],
      required: false,
      validate: (v) => Array.isArray(v),
    },
    statesSpecificPrice: {
      type: [StateSpecificSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Add indexes for better query performance
ServiceSchema.index({ organization: 1 });
ServiceSchema.index({ name: 1 });
ServiceSchema.index({ "weight_classification.weight_classification": 1 });
ServiceSchema.index({ "statesSpecificPrice.state": 1 });

ServiceSchema.plugin(mongoosePaginate);
ServiceSchema.plugin(trimStringsPlugin);

// Use getOrCreateModel instead of directly creating the model
module.exports = getOrCreateModel("Service", ServiceSchema);
