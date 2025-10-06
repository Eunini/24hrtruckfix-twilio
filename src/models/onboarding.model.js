const mongoose = require('mongoose');
const mongoosePaginate = require("mongoose-paginate-v2");
const trimStringsPlugin = require("../../utils/trim")
const { Schema } = require("mongoose");

const customerSalesSchema = new Schema({
  keyBillingContactName: { type: String, required: true },
  keyBillingContactEmail: { type: String, default: null },
  keyBillingContactPhone: { type: String, required: true },
});

const bankingDetailsSchema = new Schema({
  bankName: { type: String, default: null },
  bankAddress: { type: String, default: null },
  routingNumber: { type: String, default: null },
  accountNumber: { type: String, required: false },
  transactionalAccountsInUse: { type: Boolean, default: false },
  readOnlyAccessGranted: { type: Boolean, default: false },
});

const companySchema = new Schema({
  companyName: { type: String, required: true },
  companyWebsite: { type: String, required: true },
  primaryContactName: { type: String, default: null },
  primaryContactEmail: { type: String, required: true },
  businessTimeZone: { type: String, default: null },
  businessEntityType: { type: String, default: null },
  natureOfBusiness: { type: String, default: null },
  incorporatedIn: { type: String, default: null },
  officialAddress: { type: String, default: null },
  parentOrSubsidiary: { type: String, default: null },
  taxYear: { type: String, default: null },
});

const servicesRequestedSchema = new Schema(
  {
    platformPortalAccess: { type: Boolean, default: false },
    subAgentAccess: { type: Boolean, default: false },
    mobileAppManagementConsole: { type: Boolean, default: false },
    mobileAppServiceProvider: { type: Boolean, default: false },
    mobileAppDriver: { type: Boolean, default: false },
    advanceReportingAnalysis: { type: Boolean, default: false },
    aIBackofficeOperationsTicketing: { type: Boolean, default: false },
    aIAgentActiveCalls: { type: Boolean, default: false },
    specialTicketRequestClaims: { type: Boolean, default: false },
    prefundedBankAccount: { type: Boolean, default: false },
    passThroughBillingService: { type: Boolean, default: false },
    incomingCallDispersement: { type: Boolean, default: false },
    customDevelopment: { type: Boolean, default: false },
    primaryMechanic: { type: Boolean, default: false },
    secondaryMechanic: { type: Boolean, default: false },
    allMechanics: { type: Boolean, default: false },
    platformAccessCustomer: { type: String, default: null },
    tookanAccessAdvanceCustomer: { type: String, default: null },
    ppcMarketingServices: { type: String, default: null },
  },
  { _id: false }
);

const onboardingSchema = new Schema(
  {
    companyDetails: { type: companySchema, default: null },
    bankingDetails: { type: bankingDetailsSchema, default: null },
    vendorPayments: { type: String, enum: ["ach", "wire_transfer", "other"] },
    otherVendorPayment: { type: String, default: null },
    customerSales: { type: customerSalesSchema, default: null },
    latitude: { type: String },
    longitude: { type: String },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    servicesRequested: { type: servicesRequestedSchema, default: null },
  },
  { timestamps: true }
);

onboardingSchema.plugin(mongoosePaginate);
onboardingSchema.plugin(trimStringsPlugin);

// Create the model
const Onboarding = mongoose.model('Onboarding', onboardingSchema);

module.exports = Onboarding; 