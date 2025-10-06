const mongoose = require("mongoose");
const { Schema } = mongoose;

// Chat Thread schema
const chatThreadSchema = new Schema(
  {
    mechanicId: {
      type: Schema.Types.ObjectId,
      ref: "Mechanic",
      required: false, // Made optional to support organization chats
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: false, // Made optional to support mechanic chats
    },
    workflowId: {
      type: String,
      required: false,
    },
    title: {
      type: String,
      required: true,
      default: "New Chat",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    chatType: {
      type: String,
      enum: ["mechanic", "organization"],
      required: true,
      default: "mechanic",
    },
    variables: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for more efficient queries
chatThreadSchema.index({ mechanicId: 1 });
chatThreadSchema.index({ organizationId: 1 });
chatThreadSchema.index({ chatType: 1 });
chatThreadSchema.index({ lastMessageAt: -1 });

// Compound index for better query performance
chatThreadSchema.index({ chatType: 1, mechanicId: 1 });
chatThreadSchema.index({ chatType: 1, organizationId: 1 });

// Chat Message schema
const chatMessageSchema = new Schema(
  {
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "ChatThread",
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system", "function"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Create index for more efficient queries
chatMessageSchema.index({ threadId: 1 });
chatMessageSchema.index({ threadId: 1, createdAt: 1 });

// Vector Store Entry schema optimized for MongoDB Atlas Vector Search
const vectorStoreEntrySchema = new Schema(
  {
    text: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      required: true,
      index: true, // This will be used by Atlas Vector Search
    },
    metadata: {
      type: Object,
      required: true,
      default: {},
    },
    mechanicId: {
      type: Schema.Types.ObjectId,
      ref: "Mechanic",
      required: false, // Made optional to support organization chats
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: false, // Made optional to support mechanic chats
    },
    entryType: {
      type: String,
      enum: ["mechanic", "organization"],
      required: true,
      default: "mechanic",
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for MongoDB Atlas Vector Search
// Note: You'll need to create a vector search index in MongoDB Atlas UI or via Atlas API
vectorStoreEntrySchema.index({ "metadata.locationId": 1 });
vectorStoreEntrySchema.index({ "metadata.source": 1 });
vectorStoreEntrySchema.index({ entryType: 1 });
vectorStoreEntrySchema.index({ mechanicId: 1 });
vectorStoreEntrySchema.index({ organizationId: 1 });

const index = {
  name: "vector_index",
  type: "vectorSearch",
  definition: {
    fields: [
      {
        type: "vector",
        numDimensions: 768,
        path: "embedding",
        similarity: "cosine",
      },
    ],
  },
};

vectorStoreEntrySchema.searchIndex(index);

const ChatThread = mongoose.model("ChatThread", chatThreadSchema);
const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
const VectorStoreEntry = mongoose.model(
  "VectorStoreEntry",
  vectorStoreEntrySchema
);

module.exports = { ChatThread, ChatMessage, VectorStoreEntry };
