const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim");

const CampaignSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    organization_id: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    messagesList: [
      {
        _id: {
          type: Schema.Types.ObjectId,
          auto: true,
        },
        id: {
          type: Number,
          required: true,
        },
        message: {
          type: String,
          required: true,
          trim: true,
        },
        nextContactHourInterval: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
      },
    ],
    createdBy: {
      type: Types.ObjectId,
      ref: "Users",
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "completed"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
CampaignSchema.index({ organization_id: 1 });
CampaignSchema.index({ isActive: 1 });
CampaignSchema.index({ status: 1 });

// Plugin for pagination and trimming
CampaignSchema.plugin(mongoosePaginate);
CampaignSchema.plugin(trimStringsPlugin);

module.exports = getOrCreateModel("Campaign", CampaignSchema);