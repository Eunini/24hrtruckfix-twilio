const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim")

const AgentSchema = new Schema(
  {
    user_id: {
      type: Types.ObjectId,
      ref: "Users",
      required: true,
    },
    organization_id: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "pending",
    },
    agent_type: {
      type: String,
      enum: ["primary", "secondary", "supervisor"],
      required: true,
    },
    skills: [
      {
        type: String,
        enum: ["customer_service", "technical", "sales", "support"],
      },
    ],
    availability: {
      status: {
        type: String,
        enum: ["available", "busy", "offline"],
        default: "available",
      },
      schedule: [
        {
          day: {
            type: String,
            enum: [
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
              "sunday",
            ],
          },
          start_time: String,
          end_time: String,
        },
      ],
    },
    performance: {
      tickets_handled: { type: Number, default: 0 },
      average_response_time: { type: Number, default: 0 },
      customer_satisfaction: { type: Number, default: 0 },
      resolution_rate: { type: Number, default: 0 },
    },
    preferences: {
      notification_settings: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
      },
      auto_assignment: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

AgentSchema.plugin(mongoosePaginate);
AgentSchema.plugin(trimStringsPlugin);

// Use getOrCreateModel instead of directly creating the model
module.exports = getOrCreateModel("Agent", AgentSchema);
