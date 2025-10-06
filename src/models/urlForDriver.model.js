const mongoose = require('mongoose');
const { Schema } = mongoose;
const trimStringsPlugin = require("../../utils/trim")

const urlForDriverSchema = new Schema({
  ticket_id: {
    type: Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true,
    index: true
  },
  link_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  org_id: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  link: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 48 * 60 * 60 * 1000) // 48 hours from creation
  }
}, {
  timestamps: true,
  versionKey: false
});

urlForDriverSchema.plugin(trimStringsPlugin);

// Create compound indexes for common queries
urlForDriverSchema.index({ ticket_id: 1, isActive: 1 });
urlForDriverSchema.index({ org_id: 1, isActive: 1 });

// Add method to check if URL is expired
urlForDriverSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Add method to extend expiration
urlForDriverSchema.methods.extendExpiration = async function(hours = 24) {
  this.expiresAt = new Date(+new Date() + hours * 60 * 60 * 1000);
  return await this.save();
};

// Add method to deactivate URL
urlForDriverSchema.methods.deactivate = async function() {
  this.isActive = false;
  return await this.save();
};

// Static method to find active URL by link_id
urlForDriverSchema.statics.findActiveByLinkId = async function(link_id) {
  return await this.findOne({
    link_id,
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
};

// Static method to cleanup expired URLs
urlForDriverSchema.statics.cleanupExpired = async function() {
  return await this.updateMany(
    { expiresAt: { $lt: new Date() } },
    { isActive: false }
  );
};

// Pre-save middleware to ensure link_id is unique
urlForDriverSchema.pre('save', async function(next) {
  if (this.isNew) {
    const existing = await this.constructor.findOne({ link_id: this.link_id });
    if (existing) {
      next(new Error('A URL with this link_id already exists'));
    }
  }
  next();
});

module.exports = mongoose.model('UrlForDriver', urlForDriverSchema); 