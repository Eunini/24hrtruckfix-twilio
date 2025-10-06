const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const trimStringsPlugin = require("../../utils/trim");
const { Schema } = mongoose;

// Coordinate Schema
const coordSchema = new Schema({
  latitude: { type: String },
  longitude: { type: String },
});

// Service Schema
const serviceSchema = new Schema(
  {
    id: { type: String }, // or ObjectId if you care
    name: { type: String, required: true },
    cost: { type: Number, required: true },
  },
  { _id: false }
);

// Cell Country Schema
const cellCountrySchema = new Schema({
  label: { type: String, required: true },
  id: { type: String, required: true },
  dialCode: { type: String, required: true },
});

const commentSchema = new Schema(
  {
    text: { type: String },
    updatedAt: { type: Date, default: Date.now },
    user: { type: Schema.Types.ObjectId, ref: "Users" },
  },
  { _id: false }
);

// Sub Contractor Schema
const subContractorSchema = new Schema({
  id: { type: Schema.Types.ObjectId },
  first_name: { type: String },
  last_name: { type: String },
  email: { type: String },
});

// Address Schema
const addressSchema = new Schema({
  address_line_1: { type: String },
  street: { type: String },
  city: { type: String },
  state: { type: String },
  zipcode: { type: String },
});

// Breakdown Reason Schema
const breakdownReasonSchema = new Schema({
  label: { type: String },
  key: { type: String },
  idx: { type: Number },
});

// Ticket Schema
const ticketSchema = new Schema(
  {
    policy_number: { type: String, immutable: true },
    policy_expiration_date: { type: String, immutable: true },
    policy_address: { type: String, immutable: true },
    insured_name: { type: String, immutable: true },
    vehicle_type: { type: String },
    agency_name: { type: String },
    current_address: { type: String },
    coord: coordSchema,
    coord_details: { type: Array },
    current_cell_number: { type: String, required: true },
    cell_country_code: cellCountrySchema,
    assigned_subcontractor: {
      type: Schema.Types.ObjectId,
      ref: "Mechanic",
      default: null,
    },
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    convo_status: {
      type: String,
      enum: ["read", "unread"],
      default: null,
    },
    status: {
      type: String,
      enum: [
        "created",
        "recieved",
        "assigned", // sp has not shown up
        "dispatched", // sp delayed
        "in-progress", // sp arrived
        "cancelled",
        "completed",
        "archived",
      ],
      default: "created",
    },
    comments: [commentSchema],
    vehicle_make: { type: String, lowercase: true },
    vehicle_model: { type: String, lowercase: true },
    vehicle_color: { type: String, lowercase: true },
    vehicle_year: { type: String },
    license_plate_no: { type: String },
    breakdown_reason_text: { type: String },
    breakdown_reason: [breakdownReasonSchema],
    breakdown_address: addressSchema,
    tow_destination: addressSchema,
    scheduled_time: { type: Date },
    services: [serviceSchema],
    eta: { type: Date },
    estimated_eta: { type: Date },
    photos: [{ type: Schema.Types.ObjectId, ref: "Photo" }],
    requests: [{ type: Schema.Types.ObjectId, ref: "Request" }],
    new_request: {
      type: Boolean,
      default: false,
    },
    claim_number: { type: String },
    notes: { type: String },
    assignedByAi: {
      type: Boolean,
      default: false,
    },
    isSpecial: {
      type: Boolean,
      default: false,
    },
    humman_needed: {
      type: Boolean,
      default: false,
    },
    auto_assignment_status: {
      type: String,
      enum: ["initiated", "success", "failed", "cancelled"],
    },
    auto_assigned_at: {
      type: Date,
      validate: {
        validator: function (v) {
          return !isNaN(Date.parse(v));
        },
        message: (props) => `${props.value} is not a valid ISO date!`,
      },
    },
    auto_assigned_by: { type: String },
    client_id: { type: Schema.Types.ObjectId, ref: "Users" },
  },
  {
    timestamps: true,
    toObject: { virtuals: true, getters: true },
    toJSON: { virtuals: true, getters: true },
  }
);

ticketSchema.plugin(mongoosePaginate);
ticketSchema.plugin(trimStringsPlugin);

// Pre-save middleware to update the 'updatedAt' field
ticketSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Ticket", ticketSchema);
