const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim");

const OrganizationSchema = new Schema(
  {
    owner: {
      type: Types.ObjectId,
      ref: "Users",
      required: true,
    },
    outboundAi: { type: Boolean, default: false },
    inboundAi: { type: Boolean, default: false },
    companyName: { type: String },
    logo: { type: Buffer, default: null },
    logoContentType: { type: String, default: null },
    companyWebsite: { type: String },
    companyAddress: { type: String },
    businessEntityType: { type: String },
    keyBillingContactEmail: { type: String },
    keyBillingContactName: { type: String },
    keyBillingContactPhone: { type: String },
    approverBillingContactName: { type: String },
    approverBillingContactEmail: { type: String },
    approverBillingContactPhone: { type: String },
    billingContactSameAsMain: { type: Boolean, default: false },
    escalationContactName: { type: String },
    escalationContactEmail: { type: String },
    escalationContactPhone: { type: String },
    escalationContactSameAsMain: { type: Boolean, default: false },
    globalaiswitch: { type: Boolean, default: false },
    aiswitch: { type: Boolean, default: false },
    driverSelfService: { type: Boolean, default: false },
    beforeaistatus: { type: Boolean, default: false },
    shouldUpsertPolicies: { type: Boolean, default: false },
    organization_type: {
      type: String,
      enum: ["fleet", "insurance", "owner_operator"],
      default: "fleet",
    },
    permissions: {
      // Role-based permissions
      portalAccess: { type: Boolean, default: false },
      subAgentAccess: { type: Boolean, default: false },
      managementConsole: { type: Boolean, default: false },
      serviceProvider: { type: Boolean, default: false },
      driver: { type: Boolean, default: false },
      advanceReporting: { type: Boolean, default: false },
      aiBackoffice: { type: Boolean, default: false },
      aiAgent: { type: Boolean, default: false },
      specialTicket: { type: Boolean, default: false },
      prefundedAccount: { type: Boolean, default: false },
      passThroughBilling: { type: Boolean, default: false },
      incomingCall: { type: Boolean, default: false },
      customDevelopment: { type: Boolean, default: false },
      primaryMechanic: { type: Boolean, default: false },
      secondaryMechanic: { type: Boolean, default: false },
      allMechanics: { type: Boolean, default: true },
      customTerms: { type: Boolean, default: false },
      termId: {
        type: Types.ObjectId,
        ref: "TicketTerm",
      },

      // Action-based permissions
      actions: [
        {
          type: String,
          enum: [
            "create_ticket",
            "edit_ticket",
            "delete_ticket",
            "view_ticket",
            "assign_ticket",
            "manage_users",
            "manage_roles",
            "manage_settings",
            "view_reports",
            "manage_billing",
            "manage_organization",
          ],
        },
      ],
    },
    // Stripe Connect fields
    stripe_connect: {
      account_id: {
        type: String,
        unique: true,
        sparse: true,
      },
      onboarding_completed: {
        type: Boolean,
        default: false,
      },
      charges_enabled: {
        type: Boolean,
        default: false,
      },
      payouts_enabled: {
        type: Boolean,
        default: false,
      },
      details_submitted: {
        type: Boolean,
        default: false,
      },
      account_type: {
        type: String,
        enum: ["express", "standard", "custom"],
        default: "express",
      },
      country: {
        type: String,
        default: "US",
      },
      oauth_state: {
        type: String,
        default: null,
      },
      default_currency: {
        type: String,
        default: "usd",
      },
      onboarding_link: {
        url: String,
        expires_at: Date,
      },
      requirements: {
        currently_due: [String],
        eventually_due: [String],
        past_due: [String],
        pending_verification: [String],
        disabled_reason: String,
      },
      created_at: {
        type: Date,
      },
      updated_at: {
        type: Date,
      },
    },
    members: [
      {
        user: {
          type: Types.ObjectId,
          ref: "Users",
          required: true,
        },
        status: {
          type: String,
          enum: ["approved", "pending", "denied"],
          default: "pending",
          required: true,
        },
        addedBy: {
          type: Types.ObjectId,
          ref: "Users",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ["pending", "verified", "denied", "deactivated"],
      required: true,
      default: "pending",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    createdByManual: {
      type: Boolean,
      default: false,
    },
    urlSlug: {
      type: String,
      unique: true,
    },
    hasMarketingEnabled: {
      type: Boolean,
      default: false,
    },
    marketingEnabledAt: {
      type: Date,
      default: null,
    },
    calendar_connection: {
      provider: {
        type: String,
        enum: ["google", "outlook"],
        default: "google",
      },
      id_token: { type: String },
      connectionRefreshToken: { type: String },
      lastSync: { type: Date },
      calendarId: {
        type: String,
        default: "primary",
      },
    },
    // Tools configuration for default prompt users
    tools: [
      {
        name: {
          type: String,
          required: true,
          enum: ["endcall", "bookappointment", "knowledgebase", "calltransfer"],
        },
        metadata: {
          type: Schema.Types.Mixed,
          default: {},
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Add index for Stripe Connect account ID
OrganizationSchema.index({ "stripe_connect.account_id": 1 });

// Virtual for Stripe Connect status
OrganizationSchema.virtual("stripe_connect_status").get(function () {
  if (!this.stripe_connect?.account_id) {
    return "not_created";
  }

  if (!this.stripe_connect.onboarding_completed) {
    return "onboarding_pending";
  }

  if (
    !this.stripe_connect.charges_enabled ||
    !this.stripe_connect.payouts_enabled
  ) {
    return "restricted";
  }

  return "active";
});

// Method to check if organization can accept payments
OrganizationSchema.methods.canAcceptPayments = function () {
  return (
    this.stripe_connect?.charges_enabled && this.stripe_connect?.payouts_enabled
  );
};

// Method to update Stripe Connect information
OrganizationSchema.methods.updateStripeConnect = function (accountData) {
  if (!this.stripe_connect) {
    this.stripe_connect = {};
  }

  Object.assign(this.stripe_connect, accountData);
  this.stripe_connect.updated_at = new Date();

  return this.save();
};

OrganizationSchema.plugin(mongoosePaginate);
OrganizationSchema.plugin(trimStringsPlugin);

// Use getOrCreateModel instead of directly creating the model
module.exports = getOrCreateModel("Organization", OrganizationSchema);
