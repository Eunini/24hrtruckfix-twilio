const mongoose = require('mongoose');
const trimStringsPlugin = require("../../utils/trim")

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  client_type: {
    type: String,
    enum: ['insurance', 'fleet', 'owner_operator'],
  },
  companyName: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active'
  },
  contactPerson: {
    name: String,
    phone: String,
    email: String,
    position: String
  },
  documents: [{
    type: String, // S3 URLs
    trim: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: String,
  preferences: {
    type: Map,
    of: String
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

clientSchema.plugin(trimStringsPlugin);

// Add indexes for frequently queried fields
clientSchema.index({ email: 1 });
clientSchema.index({ phone: 1 });
clientSchema.index({ status: 1 });
clientSchema.index({ 'companyName': 1 });

module.exports = mongoose.model('Client', clientSchema); 