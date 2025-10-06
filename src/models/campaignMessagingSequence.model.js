const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim");

const CampaignMessagingSequenceSchema = new Schema(
  {
    message: {
      type: String,
      required: true,
      trim: true,
    },
    campaign_id: {
      type: Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    campaignLead_id: {
      type: Types.ObjectId,
      ref: "CampaignLeads",
      required: true,
    },
    organization_id: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    // New fields for timer functionality
    lastMessage: {
      type: String,
      trim: true,
      default: null,
    },
    messageId: {
      type: String,
      trim: true,
      default: null,
    },
    nextScheduledAt: {
      type: Date,
      default: null,
    },
    sequenceOrder: {
      type: Number,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed", "cancelled"],
      default: "pending",
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    messageType: {
      type: String,
      enum: ["sms", "email", "call"],
      default: "sms",
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
CampaignMessagingSequenceSchema.index({ campaign_id: 1 });
CampaignMessagingSequenceSchema.index({ campaignLead_id: 1 });
CampaignMessagingSequenceSchema.index({ organization_id: 1 });
CampaignMessagingSequenceSchema.index({ status: 1 });
CampaignMessagingSequenceSchema.index({ scheduledAt: 1 });
CampaignMessagingSequenceSchema.index({ nextScheduledAt: 1 });
CampaignMessagingSequenceSchema.index({ sequenceOrder: 1 });

// Compound indexes for common queries
CampaignMessagingSequenceSchema.index({ campaign_id: 1, status: 1 });
CampaignMessagingSequenceSchema.index({ campaignLead_id: 1, sequenceOrder: 1 });
CampaignMessagingSequenceSchema.index({ status: 1, scheduledAt: 1 });
CampaignMessagingSequenceSchema.index({ status: 1, nextScheduledAt: 1 });

// Plugin for pagination and trimming
CampaignMessagingSequenceSchema.plugin(mongoosePaginate);
CampaignMessagingSequenceSchema.plugin(trimStringsPlugin);

module.exports = getOrCreateModel("CampaignMessagingSequence", CampaignMessagingSequenceSchema);