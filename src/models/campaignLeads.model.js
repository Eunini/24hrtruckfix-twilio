const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim");

const CampaignLeadsSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function(v) {
          // Basic phone number validation - can be enhanced as needed
          return /^[+]?[1-9]?[0-9]{7,15}$/.test(v.replace(/[\s\-\(\)]/g, ''));
        },
        message: 'Please enter a valid phone number'
      }
    },
    campaign_id: {
      type: Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    organization_id: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "contacted", "do_not_contact"],
      default: "active",
    },
    lastContactedAt: {
      type: Date,
      default: null,
    },
    contactAttempts: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
CampaignLeadsSchema.index({ campaign_id: 1 });
CampaignLeadsSchema.index({ organization_id: 1 });
CampaignLeadsSchema.index({ phoneNumber: 1 });
CampaignLeadsSchema.index({ status: 1 });

// Compound index for campaign and status queries
CampaignLeadsSchema.index({ campaign_id: 1, status: 1 });

// Plugin for pagination and trimming
CampaignLeadsSchema.plugin(mongoosePaginate);
CampaignLeadsSchema.plugin(trimStringsPlugin);

module.exports = getOrCreateModel("CampaignLeads", CampaignLeadsSchema);