const mongoose = require('mongoose');
const { Schema } = mongoose;
const trimStringsPlugin = require("../../utils/trim")


const trackingSchema = new Schema({
  ticketId: {
    type: String,
    required: true,
    index: true
  },
  totalMechanics: {
    type: Number,
    required: true,
    default: 0
  },
  calledMechanics: {
    type: Number,
    required: true,
    default: 0
  },
  batchIndex: {
    type: Number,
    required: true,
    default: 0
  },
  foundInterest: {
    type: Boolean,
    default: false
  },
  foundInterestTime: {
    type: Date,
    default: null
  },
  allMechanics: {
    type: [Schema.Types.Mixed],
    default: []
  },
  callFinished: {
    type: Date,
    default: null
  },
  lastProcessedAt: {
    type: Date,
    default: null
  },
  cleanupReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  strict: false // Allow additional fields as in the original schema
});

trackingSchema.plugin(trimStringsPlugin);
// Add indexes for performance
trackingSchema.index({ ticketId: 1 }, { unique: true });
trackingSchema.index({ callFinished: 1 });
trackingSchema.index({ foundInterestTime: 1 });
trackingSchema.index({ 
  calledMechanics: 1, 
  totalMechanics: 1, 
  callFinished: 1 
});

// Add static methods for common queries
trackingSchema.statics.findActiveBatches = function() {
  return this.find({
    $expr: { $lt: ["$calledMechanics", "$totalMechanics"] },
    callFinished: { $exists: false }
  });
};

trackingSchema.statics.findExpiredBatches = function(minutesAgo = 10) {
  const expiredTime = new Date(Date.now() - minutesAgo * 60 * 1000);
  return this.find({
    foundInterestTime: { $lt: expiredTime },
    callFinished: { $exists: false }
  });
};

// Add instance methods
trackingSchema.methods.isExpired = function(minutesAgo = 10) {
  if (!this.foundInterestTime) return false;
  const expiredTime = new Date(Date.now() - minutesAgo * 60 * 1000);
  return this.foundInterestTime < expiredTime;
};

trackingSchema.methods.getProgress = function() {
  return {
    completed: this.calledMechanics,
    total: this.totalMechanics,
    percentage: this.totalMechanics > 0 ? (this.calledMechanics / this.totalMechanics) * 100 : 0,
    currentBatch: this.batchIndex
  };
};

// Add middleware for logging
trackingSchema.pre('save', function(next) {
  if (this.isNew) {
    console.log(`📋 New tracking record created for ticket: ${this.ticketId}`);
  } else if (this.isModified('calledMechanics')) {
    console.log(`📊 Tracking updated for ticket ${this.ticketId}: ${this.calledMechanics}/${this.totalMechanics} mechanics called`);
  }
  next();
});

module.exports = mongoose.model('TrackingCollection', trackingSchema); 