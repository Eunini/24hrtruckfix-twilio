const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const { Schema, Types } = mongoose;
const { getOrCreateModel } = require("./model.utils");
const trimStringsPlugin = require("../../utils/trim");

const DocumentSchema = new Schema(
  {
    client_id: {
      type: Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },
    organization: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    file_name: {
      type: String,
      required: true,
      trim: true,
    },
    file_key: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    file_url: {
      type: String,
      required: true,
    },
    file_type: {
      type: String,
      required: true,
    },
    file_size: {
      type: Number,
    },
    document_type: {
      type: String,
      required: true,
      enum: ["invoice", "policy", "service_provider", "general"],
      index: true,
    },
    title: {
      type: String,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: ["active", "archived", "deleted"],
      default: "active",
    },
    access_level: {
      type: String,
      enum: ["public", "private", "organization"],
      default: "private",
    },
    tags: [String],
  },
  {
    timestamps: true,
  }
);

DocumentSchema.plugin(mongoosePaginate);
DocumentSchema.plugin(trimStringsPlugin);

// Use getOrCreateModel instead of directly creating the model
module.exports = getOrCreateModel("Document", DocumentSchema);
