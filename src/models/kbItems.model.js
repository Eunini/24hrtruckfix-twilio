const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim");

const KbItemsSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["file", "url"],
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    organization: {
      type: Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    mechanic: {
      type: Types.ObjectId,
      ref: "Mechanic",
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "failed", "deleted"],
      default: "pending",
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    tags: [String],
  },
  {
    timestamps: true,
  }
);

// Ensure either organization or mechanic is provided, but not both
KbItemsSchema.pre("validate", function (next) {
  if (!this.organization && !this.mechanic) {
    return next(new Error("Either organization or mechanic must be provided"));
  }
  if (this.organization && this.mechanic) {
    return next(new Error("Cannot have both organization and mechanic"));
  }
  next();
});

KbItemsSchema.plugin(mongoosePaginate);
KbItemsSchema.plugin(trimStringsPlugin);

// Use getOrCreateModel instead of directly creating the model
module.exports = getOrCreateModel("KbItems", KbItemsSchema);
