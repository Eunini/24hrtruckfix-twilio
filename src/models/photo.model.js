const mongoose = require("mongoose");
const { Schema } = mongoose;

const photoSchema = new Schema(
  {
    image:            { type: Buffer, required: true },  
    imageContentType: { type: String, required: true },  
    uploadedAt:       { type: Date,   default: Date.now }
  },
  {
    toJSON:   { getters: true },
    toObject: { getters: true }
  }
);

module.exports = mongoose.model("Photo", photoSchema);
