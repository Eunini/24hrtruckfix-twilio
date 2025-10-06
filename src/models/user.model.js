const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim");

const UserSchema = new Schema(
  {
    cognitoId: {
      type: String,
      unique: true,
      sparse: true,
    },
    firstname: { type: String },
    lastname: { type: String },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: { type: String },
    phoneNumber: {
      type: String,
      unique: true,
    },
    username: { type: String },
    businessName: { type: String },
    role_id: {
      type: Types.ObjectId,
      ref: "Role",
      required: true,
    },
    organizations: [
      {
        type: Types.ObjectId,
        ref: "Organization",
      },
    ],
    status: {
      type: String,
      enum: [
        "active",
        "inactive",
        "pending",
        "blocked",
        "Enabled",
        "Disabled",
        "approved",
        "denied",
      ],
      default: "pending",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: true,
    },
    apiKey: {
      type: String,
      unique: true,
    },
    otp: { type: String },
    otpExpires: { type: Date },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    verificationToken: String,
    verificationExpires: Date,
    deviceToken: String,
    deviceType: String,
    twilioNumber: {
      type: String,
      unique: true,
      default: null,
    },
    stripe_customer_id: {
      type: String,
      unique: true,
      sparse: true,
    },
    image: { type: Buffer, default: null },
    imageContentType: { type: String, default: null },
    aiswitch: {
      type: Boolean,
      default: false,
    },
    beforeaistatus: {
      type: Boolean,
      default: false,
    },
    onboardUser: {
      type: Boolean,
      default: false,
    },
    isAccepted: {
      type: Boolean,
      default: false,
    },
    availabilityStatus: {
      type: String,
      enum: ["available", "busy", "offline"],
      default: "available",
    },
    createdByManual: {
      type: Boolean,
      default: false,
    },
    isInvited: {
      type: Boolean,
      default: false,
    },
    invitedBy: {
      type: Types.ObjectId,
      ref: "Users",
    },
    createdBy: {
      type: Types.ObjectId,
      ref: "Users",
    },
    invitedAt: {
      type: Date,
    },
    licenseNumber: {
      type: String,
    },
    notes: {
      type: String,
    },
    notificationSettings: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
    },
    preferences: {
      language: { type: String, default: "en" },
      timezone: { type: String, default: "UTC" },
      theme: { type: String, default: "system" },
    },
    twoFACodeHash: {
      type: String,
    },
    twoFACodeExpires: {
      type: Date,
    },
    metadata: {
      createdBy: {
        type: Types.ObjectId,
        ref: "Users",
      },
      updatedBy: {
        type: Types.ObjectId,
        ref: "Users",
      },
      notes: String,
      source: String,
    },
  },
  {
    timestamps: true,
  }
);

// Add pagination plugin
UserSchema.plugin(mongoosePaginate);
UserSchema.plugin(trimStringsPlugin);

// Pre-save middleware to hash password
UserSchema.pre("save", async function (next) {
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
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate JWT token
UserSchema.methods.generateToken = function () {
  return jwt.sign(
    { userId: this._id, username: this.username },
    process.env.JWT_SECRET,
    { expiresIn: "365d" }
  );
};

// Method to generate 2FA token
UserSchema.methods.generate2FAToken = function () {
  return jwt.sign(
    { userId: this._id, username: this.username, is2FA: true },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
};

// Method to generate 2FA Code
UserSchema.methods.generate2FACode = async function () {
  const rawCode = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const saltRounds = 10;
  const codeHash = await bcrypt.hash(rawCode, saltRounds);

  this.twoFACodeHash = codeHash;
  this.twoFACodeExpires = Date.now() + 10 * 60 * 1000;

  await this.save({ validateBeforeSave: false });
  return rawCode;
};

// Method to verify 2FA Code
UserSchema.methods.verify2FACode = async function (submittedCode) {
  if (!this.twoFACodeHash || !this.twoFACodeExpires) {
    return false;
  }

  if (Date.now() > this.twoFACodeExpires.getTime()) {
    return false;
  }

  const isMatch = await bcrypt.compare(submittedCode, this.twoFACodeHash);
  if (!isMatch) {
    return false;
  }

  this.twoFACodeHash = undefined;
  this.twoFACodeExpires = undefined;
  await this.save({ validateBeforeSave: false });

  return true;
};

// Static method to find by credentials
UserSchema.statics.findByCredentials = async function (email, password) {
  const user = await this.findOne({ email }).populate("role_id");
  if (!user) {
    throw new Error("User not found");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error("Invalid password");
  }

  return user;
};

// Pre-save middleware to ensure permissions structure
UserSchema.pre("save", function (next) {
  // If permissions is an array or undefined, convert it to the correct object structure
  if (
    Array.isArray(this.permissions) ||
    !this.permissions ||
    typeof this.permissions !== "object"
  ) {
    this.permissions = {
      // Role-based permissions - set defaults
      portalAccess: false,
      subAgentAccess: false,
      managementConsole: false,
      serviceProvider: false,
      driver: false,
      advanceReporting: false,
      aiBackoffice: false,
      aiAgent: false,
      specialTicket: false,
      prefundedAccount: false,
      passThroughBilling: false,
      incomingCall: false,
      customDevelopment: false,
      primaryMechanic: false,
      secondaryMechanic: false,
      allMechanics: false,

      // Action-based permissions
      actions: [],
    };
  }

  // Ensure actions is always an array
  if (!Array.isArray(this.permissions.actions)) {
    this.permissions.actions = [];
  }

  next();
});

// Update the updatedAt field before save
UserSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = getOrCreateModel("Users", UserSchema);
