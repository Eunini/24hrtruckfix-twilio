// models/unassignedMessage.model.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const UnassignedMessageSchema = new Schema(
  {
    twilioSid: { type: String, index: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    body: { type: String },
    dateSent: { type: Date, default: Date.now },
    reason: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

const UnassignedMessage = mongoose.model("UnassignedMessage", UnassignedMessageSchema);

module.exports = UnassignedMessage;
