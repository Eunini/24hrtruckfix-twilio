const { Schema, model } = require("mongoose");

const MessageSchema = new Schema(
  {
    sid: { type: String, required: true, unique: true, index: true },
    from: { type: String, index: true },
    to: { type: String, index: true },
    status: { type: String },
    body: { type: String },
    direction: { type: String },
    dateSent: { type: Date, index: true },
    dateCreated: { type: Date },
    // numMedia: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = model("Message", MessageSchema);
