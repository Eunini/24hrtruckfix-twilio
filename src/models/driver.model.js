// src/models/DriverPortalSettings.js
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim");

const DriverSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
    },
    otpExpires: {
      type: Date,
    },
    otpAttempts: {
      type: Number,
      default: 0,
    },
    password: {
      type: String,
      required: true,
    },
    organization: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    role_id: {
      type: Types.ObjectId,
      ref: "Role",
      required: true,
    },
    plan: {
      type: String,
      enum: ["monthly", "payperuse"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "inactive", "suspended"],
      default: "pending",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    licenseNumber: {
      type: String,
      trim: true,
    },
    vehicleInfo: {
      make: String,
      model: String,
      year: Number,
      plateNumber: String,
      vinNumber: String,
    },
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String,
    },
    lastLogin: {
      type: Date,
    },
    otp: {
      type: Number,
    },
    otpExpires: {
      type: Date,
    },
    // Stripe-related fields for payments and subscriptions
    stripe_customer_id: {
      type: String,
      index: true,
    },
    defaultPaymentMethodId: {
      type: String,
    },
    stripeSubscriptionId: {
      type: String,
      index: true,
    },
    subscriptionStatus: {
      type: String,
      enum: [
        "incomplete",
        "incomplete_expired",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
      ],
      default: null,
    },
    subscriptionStartDate: {
      type: Date,
    },
    subscriptionEndDate: {
      type: Date,
    },
    lastPaymentDate: {
      type: Date,
    },
    payPerUseStatus: {
      type: String,
      enum: ["pending", "paid", "expired"],
      default: null,
    },
    payPerUseExpiryDate: {
      type: Date,
    },
    preferences: {
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
      },
      notification_type: {
        service: { type: Boolean, default: true },
        billing: { type: Boolean, default: true },
        promo_emails: { type: Boolean, default: true },
      },
      workingHours: {
        start: { type: String, default: "09:00" },
        end: { type: String, default: "17:00" },
      },
    },
  },
  {
    timestamps: true,
  }
);

// Add pagination plugin
DriverSchema.plugin(mongoosePaginate);
DriverSchema.plugin(trimStringsPlugin);

// Pre-save middleware to hash password
DriverSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
DriverSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate regular JWT token
DriverSchema.methods.generateToken = function () {
  return jwt.sign(
    {
      driverId: this._id,
      email: this.email,
      organizationId: this.organization,
      role: "driver",
      tokenType: "regular",
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// Method to generate registration token (not stored in database)
DriverSchema.methods.generateRegistrationToken = function () {
  const token = jwt.sign(
    {
      driverId: this._id,
      email: this.email,
      organizationId: this.organization,
      role: "driver",
      tokenType: "registration",
    },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  return token;
};

// Method to generate OTP
DriverSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  this.otp = otp;
  this.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return otp;
};

// Method to verify OTP
DriverSchema.methods.verifyOTP = function (submittedOTP) {
  if (!this.otp || !this.otpExpires) {
    return false;
  }

  if (Date.now() > this.otpExpires.getTime()) {
    return false;
  }

  if (this.otp !== Number(submittedOTP)) {
    this.otpAttempts += 1;
    return false;
  }

  // OTP is valid, clear it and mark phone as verified
  this.otp = undefined;
  this.otpExpires = undefined;
  this.otpAttempts = 0;
  this.phoneVerified = true;

  return true;
};

// Static method to find by credentials
DriverSchema.statics.findByCredentials = async function (email, password) {
  const driver = await this.findOne({ email }).populate("role_id organization");
  if (!driver) {
    throw new Error("Driver not found");
  }

  const isMatch = await driver.comparePassword(password);
  if (!isMatch) {
    throw new Error("Invalid password");
  }

  return driver;
};

// Update the updatedAt field before save
DriverSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = getOrCreateModel("Driver", DriverSchema);
