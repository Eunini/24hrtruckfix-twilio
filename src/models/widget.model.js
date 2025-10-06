const mongoose = require("mongoose");
const { Schema } = mongoose;

const WidgetSchema = new Schema(
  {
    allowedOrigins: {
      type: [String], // Fixed: Changed from String to [String] for array of strings
      default: [],
    },
    mechanicId: {
      type: Schema.Types.ObjectId,
      ref: "Mechanic",
      required: true,
      unique: true,
    },
    config: {
      type: Object,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Widget = mongoose.model("Widget", WidgetSchema);
module.exports = Widget;
