const mongoose = require("mongoose");
const trimStringsPlugin = require("../../utils/trim");
const mongoosePaginate = require("mongoose-paginate-v2");
const { Schema } = require("mongoose");

const AiConfigsSchema = new Schema(
  {
    client_id: [
      {
        type: Schema.Types.ObjectId,
        ref: "Users",
      },
    ],
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
    },
    outbound_assistant_id: {
      type: String,
      required: false,
    },
    inbound_assistant_id: {
      type: String,
      required: false,
    },
    number: {
      type: String,
      required: false,
    },
    phone_number_sid: {
      type: String,
      required: false,
      description: "Twilio phone number SID",
    },
    vapi_phone_number_id: {
      type: String,
      required: false,
      description: "VAPI phone number ID",
    },
    // Additional metadata
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    setup_completed: {
      type: Boolean,
      default: false,
    },
    setup_date: {
      type: Date,
      default: Date.now,
    },
    markerting_agents: {
      type: {
        inbound: {
          type: String,
          required: false,
        },
        outbound: {
          type: String,
          required: false,
        },
        web: {
          type: String,
          required: false,
        },
        phone_number: {
          type: String,
          required: false,
        },
        phone_number_sid: {
          type: String,
          required: false,
        },
      },
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

AiConfigsSchema.plugin(mongoosePaginate);
AiConfigsSchema.plugin(trimStringsPlugin);

// Create the model
const AIConfig = mongoose.model("AIConfig", AiConfigsSchema);

module.exports = AIConfig;
