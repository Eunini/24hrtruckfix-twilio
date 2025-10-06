const mongoose = require('mongoose');
const { Schema } = mongoose;
const trimStringsPlugin = require("../../utils/trim")

const detailSchema = new Schema({
  step:       { type: String, required: true },                            
  status:     { type: String, enum: ['running','success','error'], required: true },
  metadata:   { type: Schema.Types.Mixed, default: {} },                   
  createdAt:  { type: Date, default: () => new Date() }
}, { _id: false });

const aiProgressSchema = new Schema({
  ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, unique: true },
  details:  { type: [detailSchema], default: [] }
}, {
  timestamps: true, 
  versionKey: false
});

detailSchema.plugin(trimStringsPlugin);


module.exports = mongoose.model('AiProgress', aiProgressSchema);