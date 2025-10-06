const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const trimStringsPlugin = require("../../utils/trim");
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");

const AICallActivitySchema = new Schema(
  {
    call_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    organization_id: {
      type: Types.ObjectId,
      ref: "Organization",
      required: false,
      index: true,
    },
    mechanic_id: {
      type: Types.ObjectId,
      ref: "Mechanic",
      required: false,
      index: true,
    },
    call_type: {
      type: String,
      enum: ["inbound", "outbound", "chat", "web-call"],
      required: true,
      index: true,
    },
    number: {
      type: String,
      required: true,
    },
    recorded_time: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Add pagination plugin
AICallActivitySchema.plugin(mongoosePaginate);
AICallActivitySchema.plugin(trimStringsPlugin);

// Use getOrCreateModel instead of directly creating the model
module.exports = getOrCreateModel("AICallActivity", AICallActivitySchema);
