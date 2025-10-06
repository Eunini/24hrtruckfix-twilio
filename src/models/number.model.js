const mongoose = require("mongoose");

const PhoneNumberSchema = new mongoose.Schema(
  {
    sid: { type: String },
    phoneNumber: { type: String },
    friendlyName: { type: String },
    cachedAt: { type: Date, default: Date.now },
    capabilities: {
      type: Object, 
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PhoneNumber", PhoneNumberSchema);
