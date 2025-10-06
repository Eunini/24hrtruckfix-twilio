const { Schema, model } = require("mongoose");

const CallSchema = new Schema(
  {
    sid: { type: String, required: true, unique: true, index: true },
    from: { type: String, index: true },
    to: { type: String, index: true },
    startTime: { type: Date, index: true },
    endTime: { type: Date },
    duration: { type: Number },
    status: { type: String },
    price: { type: String },
    // direction: { type: String },
  },
  { timestamps: true }
);

module.exports = model("Call", CallSchema);
