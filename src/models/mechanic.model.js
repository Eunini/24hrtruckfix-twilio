const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { Schema } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim");

const MechanicSchema = new Schema(
  {
    client_id: [{ type: String }],
    organization_id: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
    }],
    web_agent_id: { type: String }, // VAPI web agent ID for widget functionality
    email_2: { type: String },
    office_num: { type: String },
    tags: { type: [String] },
    schedule: { type: [String] },
    shop_mobile_only: { type: [String] },
    purpose: { type: String },
    city: { type: String },
    specialty: { type: [String] },
    blacklisted: [
      {
        client_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        organization_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Organization",
        },
        reason: {
          type: String,
        },
      },
    ],
    education_experience_prepared_for: { type: String },
    minimum_hourly_requirements: { type: String },
    service_call_rate: { type: String },
    labor_rate: { type: String },
    mileage: { type: String },
    age: { type: String },
    conversion_date: { type: Date },
    conversion_page: { type: String },
    conversion_title: { type: String },
    yrs_exp: { type: String },
    future_relationships: { type: String },
    website_url: { type: String },
    social_media_handles: { type: [String] },
    comments_posts: { type: String },
    coverage_zips: { type: String },
    coverage_miles: { type: String },
    policy_limits: { type: String },
    sp_insurance: { type: String },
    stripe: { type: Boolean, default: false },
    // Enhanced Stripe Connect fields
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
    payments_additional: { type: String },
    team_id: { type: String },
    secondary_team: { type: String },
    negotiated_rate: { type: String },
    student_professional: { type: String },
    isAccepted: { type: Boolean, default: false },
    createdByManual: { type: Boolean, default: false },
    businessNumber: { type: String },
    OtherServices: { type: String },
    acceptBerkeley: { type: Boolean, default: false },
    address: { type: String },
    businessName: { type: String },
    companyName: { type: String },
    country: { type: String },
    currentInsurance: { type: [String] },
    email: { type: String },
    firstName: { type: String },
    hasOnboarded: { type: Boolean, default: false },
    holidayAvailability: { type: Boolean, default: false },
    id: { type: String },
    insuranceCoverage: { type: Boolean, default: false },
    labour_Hr: { type: Number },
    lastName: { type: String },
    mechanicLocation: {
      type: { type: String, default: "Point" },
      coordinates: { type: [Number], default: [0, 0] },
    },
    mechanicLocationLatitude: { type: String },
    mechanicLocationLongitude: { type: String },
    mobileNumber: { type: String },
    nightAvailability: { type: Boolean, default: false },
    paymentMethods: { type: [String] },
    picOfLicence: [
      {
        url: { type: String },
        filename: { type: String },
      },
    ],
    serviceCapabilities: { type: [String] },
    serviceCoverage: { type: String },
    specialCapabilities: { type: [String] },
    state: { type: String },
    surroundingMiles: { type: [String] },
    ticketID: { type: String },
    timestamp: { type: Date },
    weekendAvailability: { type: Boolean, default: false },
    zipcode: { type: String },
    isPrimary: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toObject: { virtuals: true, getters: true },
    toJSON: { virtuals: true, getters: true },
  }
);

// 2dsphere index for geospatial
MechanicSchema.index({ mechanicLocation: "2dsphere" });

// Add index for Stripe Connect account ID
MechanicSchema.index({ "stripe_connect.account_id": 1 });

// Virtual for Stripe Connect status
MechanicSchema.virtual("stripe_connect_status").get(function () {
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

// Method to check if mechanic can accept payments
MechanicSchema.methods.canAcceptPayments = function () {
  return (
    this.stripe_connect?.charges_enabled && this.stripe_connect?.payouts_enabled
  );
};

// Method to update Stripe Connect information
MechanicSchema.methods.updateStripeConnect = function (accountData) {
  if (!this.stripe_connect) {
    this.stripe_connect = {};
  }

  Object.assign(this.stripe_connect, accountData);
  this.stripe_connect.updated_at = new Date();

  // Update the legacy stripe field
  this.stripe = this.canAcceptPayments();

  return this.save();
};

MechanicSchema.plugin(mongoosePaginate);
MechanicSchema.plugin(trimStringsPlugin);

// Use getOrCreateModel instead of directly creating the model
module.exports = getOrCreateModel("Mechanic", MechanicSchema);
