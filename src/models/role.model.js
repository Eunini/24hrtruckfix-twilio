const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const { Schema } = mongoose;
const { getOrCreateModel } = require('./model.utils');
const trimStringsPlugin = require("../../utils/trim")

const RoleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    permissions: [{
      type: String,
      required: true,
    }],
    isActive: {
      type: Boolean,
      default: true,
    }
  },
  {
    timestamps: true,
  }
);

RoleSchema.plugin(mongoosePaginate);
RoleSchema.plugin(trimStringsPlugin);

// Use getOrCreateModel instead of directly creating the model
module.exports = getOrCreateModel('Role', RoleSchema); 