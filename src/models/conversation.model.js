// models/conversation.model.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const MessageSubSchema = new Schema(
  {
    from: { type: String, required: true },
    to: { type: String, required: true },
    body: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "failed", "received"],
      default: "pending",
    },
    twilioSid: { type: String, index: true },
    error: { type: String },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ConversationSchema = new Schema(
  {
    participants: [
      {
        phone: { type: String, required: true },
        role: { type: String, enum: ["agent", "mechanic", "driver", "user"] },
      },
    ],
    messages: { type: [MessageSubSchema], default: [] },
    status: { type: String, enum: ["open", "closed"], default: "open" },
    lastUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Helper to append message and trim recent size if needed
ConversationSchema.methods.appendMessage = async function (msgObj, recentLimit = 5000) {
  this.messages.push(msgObj);
  this.lastUpdatedAt = new Date();
  if (this.messages.length > recentLimit) {
    this.messages = this.messages.slice(-recentLimit);
  }
  await this.save();
  return this;
};

ConversationSchema.index(
  { "participants.role": 1, "participants.phone": 1 },
  { "messages.twilioSid": 1 },
  {
    unique: true,
    partialFilterExpression: { "participants.role": { $in: ["mechanic", "driver"] } }
  }
);


const Conversation = mongoose.model("Conversation", ConversationSchema);

module.exports = Conversation;
