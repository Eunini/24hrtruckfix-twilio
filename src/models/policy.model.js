const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { Schema } = mongoose;
const trimStringsPlugin = require("../../utils/trim")


// Driver Schema
const driverSchema = new Schema(
  {
    client_id: { type: Schema.Types.ObjectId, ref: "Users" },
    first_name: { type: String },
    last_name: { type: String },
    date_of_birth: { type: Date },
    license_number: { type: String },
    license_state: { type: String },
    license_expiration_date: { type: Date },
  },
  {
    timestamps: true,
    _id: true,
  }
);

// Warranty Schema
const warrantySchema = new Schema({
  warrantyNumber: { type: String },
  coverageType: {
    type: String,
    enum: ["full-vehicle", "specific-parts", "system", "powertrain",
          "drivetrain", "engine", "transmission", "electrical", 
          "emissions", "corrosion", "roadside-assistance", "other",],
  },
  coveredParts: [
    {
      partName: { type: String },
      partNumber: { type: String },
      coverageLimit: { type: Number },
      notes: { type: String },
    },
  ],
  authorizedServiceProviders: [
    {
      provider: {
        type: Schema.Types.ObjectId,
        ref: "mechanics",
      },
      isPrimary: { type: Boolean, default: false },
      laborRate: { type: Number },
      authorizationNotes: { type: String },
    },
  ],
  startDate: { type: Date },
  endDate: { type: Date },
  terms: { type: String },
  deductible: { type: Number },
  isTransferable: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

// Vehicle Schema
const vehicleSchema = new Schema(
  {
    vehicle_model_year: { type: String },
    vehicle_manufacturer: { type: String },
    vehicle_model: { type: String },
    vehicle_vin: { type: String },
    vehicle_color: { type: String },
    licensePlate: { type: String },
    warranties: [warrantySchema],
    drivers: [driverSchema],
  },
  { _id: false }
);

// Policy Schema
const policySchema = new Schema(
  {
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    policy_number: { type: String },
    policy_effective_date: { type: String },
    policy_expiration_date: { type: String },
    insured_first_name: { type: String },
    insured_middle_initial: { type: String },
    insured_last_name: { type: String },
    risk_address_line_1: { type: String },
    risk_address_city: { type: String },
    risk_address_state: { type: String },
    risk_address_zip_code: { type: String },
    vehicles: [vehicleSchema],
    agency_name: { type: String },
    seller_userid: { type: String },
    address: { type: String },
    version: { type: Number },
    policy_creation_api_type: {
      type: String,
      enum: ["admin-api", "file-upload-api", "driver-portal"],
      default: "file-upload-api",
    },
    added_by: { type: String },
    coverageLimit: { type: Number },
  },
  {
    timestamps: true,
    toObject: { virtuals: true, getters: true },
    toJSON: { virtuals: true, getters: true },
  }
);

// policySchema.index({ policy_number: 1 }, { unique: true });
policySchema.plugin(mongoosePaginate);
policySchema.plugin(trimStringsPlugin);

module.exports = mongoose.model("Policy", policySchema);
