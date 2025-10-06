const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const trimStringsPlugin = require("../../utils/trim")
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");

const AIActivitySchema = new Schema(
  {
    user_id: {
      type: Types.ObjectId,
      ref: "Users",
      required: true,
    },
    activity_type: {
      type: String,
      enum: [
        "ticket_creation",
        "ticket_assignment",
        "analysis",
        "recommendation",
      ],
      required: true,
    },
    ticket_id: {
      type: Types.ObjectId,
      ref: "Ticket",
    },
    details: {
      input: Schema.Types.Mixed,
      output: Schema.Types.Mixed,
      confidence_score: Number,
      processing_time: Number,
    },
    status: {
      type: String,
      enum: ["success", "failed", "pending"],
      default: "pending",
    },
    error: {
      code: String,
      message: String,
      stack: String,
    },
  },
  {
    timestamps: true,
  }
);

AIActivitySchema.plugin(mongoosePaginate);
AIActivitySchema.plugin(trimStringsPlugin);

// Use getOrCreateModel instead of directly creating the model
module.exports = getOrCreateModel("AIActivity", AIActivitySchema);
