const mongoose = require("mongoose");
const { Schema } = mongoose;

const CustomPromptSchema = new Schema(
  {
    mechanicId: {
      type: Schema.Types.ObjectId,
      ref: "Mechanic",
      required: true,
      unique: true, // One prompt per mechanic
    },
    chatPrompt: {
      type: String,
      required: false,
      default: "",
    },
    voicePrompt: {
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

// Create indexes for efficient queries
CustomPromptSchema.index({ mechanicId: 1 });
CustomPromptSchema.index({ isActive: 1 });

const CustomPrompt = mongoose.model("CustomPrompt", CustomPromptSchema);

module.exports = CustomPrompt;
