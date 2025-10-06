const mongoose = require('mongoose');
const { Schema } = mongoose;

const systemStatusSchema = new Schema({
  active: {
    type: Boolean,
    required: true,
    default: true
  },
  liveMode: {
    type: Boolean,
    required: true,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Add an index to optimize queries
systemStatusSchema.index({ active: 1, liveMode: 1 });

// Add a static method to get system status
systemStatusSchema.statics.getStatus = async function() {
  const status = await this.findOne();
  return status || await this.create({ active: true, liveMode: true });
};

// Add instance methods for common operations
systemStatusSchema.methods.toggleActive = async function() {
  this.active = !this.active;
  return await this.save();
};

systemStatusSchema.methods.toggleLiveMode = async function() {
  this.liveMode = !this.liveMode;
  return await this.save();
};

// Add middleware to log status changes
systemStatusSchema.pre('save', function(next) {
  if (this.isModified('active') || this.isModified('liveMode')) {
    console.log('System status changed:', {
      active: this.active,
      liveMode: this.liveMode,
      timestamp: new Date()
    });
  }
  next();
});

module.exports = mongoose.model('SystemStatus', systemStatusSchema); 