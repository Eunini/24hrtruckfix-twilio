const mongoose = require("mongoose");
const { Schema } = mongoose;
// Service Schema
  const serviceSchema = new Schema(
    {
      id: { type: String }, // or ObjectId if you care
      name: { type: String, required: true },
      cost: { type: Number, required: true },
    },
    { _id: false }
  );

const RequestSchema = new Schema({
    ticket_id: { 
        type: Schema.Types.ObjectId, 
        ref: "Ticket", 
        required: true 
    },
    mechanic_id: { 
        type: Schema.Types.ObjectId, 
        ref: "Mechanic" 
    },
    services: [serviceSchema],
    total_cost: { type: Number },
    eta: { type: String }, 
    status: {
        type: String,
        enum: ["agreed", "declined", "wait"],
        default: "wait"
    },
    notes: { type: String, default: "" },
    },
    { 
        timestamps: true 
    }
);

module.exports = mongoose.model("Request", RequestSchema);
