const mongoose = require("mongoose");
const { Schema } = mongoose;

const OrganizationWidgetSchema = new Schema(
  {
    allowedOrigins: {
      type: [String],
      default: [],
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    config: {
      type: Object,
      required: true,
    },
    widgetType: {
      type: String,
      enum: ["marketing", "support", "sales", "custom"],
      default: "marketing",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
OrganizationWidgetSchema.index({ organizationId: 1, widgetType: 1 });
OrganizationWidgetSchema.index({ isActive: 1 });

const OrganizationWidget = mongoose.model(
  "OrganizationWidget",
  OrganizationWidgetSchema
);
module.exports = OrganizationWidget;
