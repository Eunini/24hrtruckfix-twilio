const mongoose = require("mongoose");
const { Schema } = mongoose;

const ClientCustomPromptSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    prompt: {
      type: String,
      required: false,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    callInitiationType: {
      type: String,
      enum: ["ai-initiates", "human-initiates", "ai-initiates-static"],
      default: "ai-initiates",
    },
    staticMessage: {
      type: String,
      default: "",
    },
    promptType: {
      type: String,
      enum: ["web-chat", "web-voice", "inbound-voice", "outbound-voice", "dispatch", "concierge"],
      required: true,
    },
    agentID: {
      type: String,
      required: function () {
        return this.promptType !== "web-chat";
      },
    },
    promptsFlow: {
      type: Object,
      default: {},
    },
    tools: {
      type: [
        {
          name: {
            type: String,
            required: true,
          },
          metadata: {
            type: Schema.Types.Mixed,
            required: false,
          },
        },
      ],
      default: [
        { name: "knowledgebase" },
        { name: "endcall" },
        { name: "bookappointment" },
      ],
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index to ensure one prompt per organization per type
ClientCustomPromptSchema.index(
  { organizationId: 1, promptType: 1 },
  { unique: true }
);

// Create additional indexes for efficient queries
ClientCustomPromptSchema.index({ organizationId: 1 });
ClientCustomPromptSchema.index({ isActive: 1 });
ClientCustomPromptSchema.index({ promptType: 1 });

const ClientCustomPrompt = mongoose.model(
  "ClientCustomPrompt",
  ClientCustomPromptSchema
);

module.exports = ClientCustomPrompt;
