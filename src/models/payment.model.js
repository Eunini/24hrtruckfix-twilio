const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim")

const PaymentSchema = new Schema(
  {
    // Stripe payment intent ID
    paymentIntentId: {
      type: String,
      required: true,
      index: true,
    },

    // User information (can be driver, customer, etc.)
    userId: {
      type: Types.ObjectId,
      required: true,
      index: true,
    },

    userType: {
      type: String,
      required: true,
      enum: ["driver", "customer", "mechanic", "user"],
      index: true,
    },

    // Organization reference
    organizationId: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // Payment amounts (in dollars)
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    applicationFeeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Currency
    currency: {
      type: String,
      default: "usd",
      uppercase: true,
    },

    // Payment status
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "completed",
        "failed",
        "canceled",
        "refunded",
      ],
      default: "pending",
      index: true,
    },

    // Payment description
    description: {
      type: String,
      required: true,
    },

    // Payment method information (optional)
    paymentMethod: {
      type: {
        type: String,
        enum: ["card", "bank_account", "other"],
      },
      brand: String,
      last4: String,
      expMonth: Number,
      expYear: Number,
    },

    // Stripe customer ID
    stripeCustomerId: {
      type: String,
      index: true,
    },

    // Connected account ID (for organizations)
    stripeConnectedAccountId: {
      type: String,
      index: true,
    },

    // Payment date
    paymentDate: {
      type: Date,
    },

    // Refund information
    refunds: [
      {
        stripeRefundId: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        reason: {
          type: String,
          enum: ["duplicate", "fraudulent", "requested_by_customer", "other"],
          default: "requested_by_customer",
        },
        description: String,
        status: {
          type: String,
          enum: ["pending", "succeeded", "failed", "canceled"],
          default: "pending",
        },
        refundedAt: Date,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Flexible metadata for additional information
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Error information
    error: {
      type: String,
    },

    errorCode: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
PaymentSchema.index({ userId: 1, userType: 1 });
PaymentSchema.index({ organizationId: 1, status: 1 });
PaymentSchema.index({ paymentIntentId: 1 });
PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ userType: 1, createdAt: -1 });

// Virtual for total refunded amount
PaymentSchema.virtual("totalRefunded").get(function () {
  return this.refunds
    .filter((refund) => refund.status === "succeeded")
    .reduce((total, refund) => total + refund.amount, 0);
});

// Virtual for net amount (amount - refunds)
PaymentSchema.virtual("netAmount").get(function () {
  return this.amount - this.totalRefunded;
});

// Virtual for payment method display
PaymentSchema.virtual("paymentMethodDisplay").get(function () {
  if (this.paymentMethod && this.paymentMethod.type === "card") {
    return `${this.paymentMethod.brand?.toUpperCase()} •••• ${
      this.paymentMethod.last4
    }`;
  }
  return this.paymentMethod?.type || "Unknown";
});

// Methods
PaymentSchema.methods.addRefund = function (refundData) {
  this.refunds.push(refundData);
  return this.save();
};

PaymentSchema.methods.updateStatus = function (status, additionalData = {}) {
  this.status = status;

  if (status === "completed" && !this.paymentDate) {
    this.paymentDate = new Date();
  }

  // Update additional fields
  Object.assign(this, additionalData);

  return this.save();
};

// Static methods
PaymentSchema.statics.findByUser = function (userId, userType, options = {}) {
  const query = this.find({ userId, userType });

  if (options.status) {
    query.where("status", options.status);
  }

  if (options.dateFrom) {
    query.where("createdAt").gte(options.dateFrom);
  }

  if (options.dateTo) {
    query.where("createdAt").lte(options.dateTo);
  }

  return query
    .populate("organizationId", "companyName")
    .sort({ createdAt: -1 });
};

PaymentSchema.statics.findByOrganization = function (
  organizationId,
  options = {}
) {
  const query = this.find({ organizationId });

  if (options.userType) {
    query.where("userType", options.userType);
  }

  if (options.status) {
    query.where("status", options.status);
  }

  if (options.dateFrom) {
    query.where("createdAt").gte(options.dateFrom);
  }

  if (options.dateTo) {
    query.where("createdAt").lte(options.dateTo);
  }

  return query.sort({ createdAt: -1 });
};

PaymentSchema.statics.getRevenueStats = function (filters = {}) {
  const matchStage = { status: "completed" };

  if (filters.organizationId) {
    matchStage.organizationId = filters.organizationId;
  }

  if (filters.userType) {
    matchStage.userType = filters.userType;
  }

  if (filters.dateFrom || filters.dateTo) {
    matchStage.createdAt = {};
    if (filters.dateFrom) matchStage.createdAt.$gte = filters.dateFrom;
    if (filters.dateTo) matchStage.createdAt.$lte = filters.dateTo;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          userType: "$userType",
          organizationId: "$organizationId",
        },
        totalRevenue: { $sum: "$amount" },
        totalApplicationFees: { $sum: "$applicationFeeAmount" },
        paymentCount: { $sum: 1 },
        averagePayment: { $avg: "$amount" },
      },
    },
  ]);
};

PaymentSchema.plugin(mongoosePaginate);
PaymentSchema.plugin(trimStringsPlugin);

const Payment = getOrCreateModel("Payment", PaymentSchema);

module.exports = Payment;
