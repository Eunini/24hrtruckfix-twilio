const trimStringsPlugin = require("../../utils/trim")
const mongoose = require("mongoose");
const { Schema } = mongoose;

const ticketTermSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "Organization", 
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

ticketTermSchema.index({ client: 1}, { unique: true });
ticketTermSchema.plugin(trimStringsPlugin);

module.exports = mongoose.model("TicketTerm", ticketTermSchema);