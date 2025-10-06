const mongoose = require("mongoose");
const Campaign = require("./src/models/campaign.model");
const CampaignLeads = require("./src/models/campaignLeads.model");
const campaignsService = require("./src/services/campaigns.service");

// Mock Twilio service to avoid requiring actual credentials
jest.mock("./src/services/twilio.service", () => ({
  sendSMS: jest.fn().mockResolvedValue({
    success: true,
    sid: "mock_message_sid",
    status: "sent"
  })
}));

// Test configuration
const TEST_CONFIG = {
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/24hourservice_test",
  TEST_TIMEOUT: 30000
};

describe("Campaign Activation Immediate Processing", () => {
  let testCampaign;
  let testOrganizationId;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(TEST_CONFIG.MONGODB_URI);
    console.log("✅ Connected to test database");
  });

  afterAll(async () => {
    // Clean up and disconnect
    if (testCampaign) {
      await Campaign.findByIdAndDelete(testCampaign._id);
      await CampaignLeads.deleteMany({ campaign_id: testCampaign._id });
    }
    await mongoose.disconnect();
    console.log("✅ Disconnected from test database");
  });

  beforeEach(async () => {
    // Create test organization ID
    testOrganizationId = new mongoose.Types.ObjectId();

    // Create test campaign
    testCampaign = await Campaign.create({
      name: "Test Campaign for Activation",
      organization_id: testOrganizationId,
      createdBy: new mongoose.Types.ObjectId(),
      isActive: false,
      status: "draft",
      messagesList: [
        {
          id: 1,
          message: "Hello! This is your first message from our test campaign.",
          nextContactHourInterval: 24
        },
        {
          id: 2,
          message: "This is a follow-up message.",
          nextContactHourInterval: 48
        }
      ]
    });

    // Add test leads to the campaign
    await CampaignLeads.create([
      {
        name: "Test Lead 1",
        phoneNumber: "+1234567890",
        campaign_id: testCampaign._id,
        organization_id: testOrganizationId,
        status: "active",
        contactAttempts: 0
      },
      {
        name: "Test Lead 2", 
        phoneNumber: "+1234567891",
        campaign_id: testCampaign._id,
        organization_id: testOrganizationId,
        status: "active",
        contactAttempts: 0
      }
    ]);

    console.log(`📋 Created test campaign: ${testCampaign._id}`);
  });

  afterEach(async () => {
    // Clean up test data
    if (testCampaign) {
      await Campaign.findByIdAndDelete(testCampaign._id);
      await CampaignLeads.deleteMany({ campaign_id: testCampaign._id });
    }
  });

  test("Should trigger immediate processing when campaign is activated", async () => {
    console.log("🧪 Testing campaign activation immediate processing...");

    // Activate the campaign
    const activatedCampaign = await campaignsService.toggleCampaignStatus(testCampaign._id, true);

    // Verify campaign is activated
    expect(activatedCampaign.isActive).toBe(true);
    expect(activatedCampaign.status).toBe("active");

    // Wait a moment for the immediate processing to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if leads were processed (should have contactAttempts incremented)
    const processedLeads = await CampaignLeads.find({ campaign_id: testCampaign._id });
    
    console.log("📊 Processed leads:", processedLeads.map(lead => ({
      name: lead.name,
      contactAttempts: lead.contactAttempts,
      lastContactedAt: lead.lastContactedAt
    })));

    // Verify that leads were processed
    const leadsWithContact = processedLeads.filter(lead => lead.contactAttempts > 0);
    expect(leadsWithContact.length).toBeGreaterThan(0);

    console.log("✅ Campaign activation immediate processing test passed!");
  }, TEST_CONFIG.TEST_TIMEOUT);

  test("Should not trigger processing when campaign is deactivated", async () => {
    console.log("🧪 Testing campaign deactivation...");

    // First activate the campaign
    await campaignsService.toggleCampaignStatus(testCampaign._id, true);
    
    // Wait for any processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get initial contact attempts
    const initialLeads = await CampaignLeads.find({ campaign_id: testCampaign._id });
    const initialContactAttempts = initialLeads.reduce((sum, lead) => sum + lead.contactAttempts, 0);

    // Deactivate the campaign
    const deactivatedCampaign = await campaignsService.toggleCampaignStatus(testCampaign._id, false);

    // Verify campaign is deactivated
    expect(deactivatedCampaign.isActive).toBe(false);
    expect(deactivatedCampaign.status).toBe("paused");

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check that no additional processing occurred
    const finalLeads = await CampaignLeads.find({ campaign_id: testCampaign._id });
    const finalContactAttempts = finalLeads.reduce((sum, lead) => sum + lead.contactAttempts, 0);

    expect(finalContactAttempts).toBe(initialContactAttempts);

    console.log("✅ Campaign deactivation test passed!");
  }, TEST_CONFIG.TEST_TIMEOUT);
});

// Run the tests if this file is executed directly
if (require.main === module) {
  console.log("🚀 Starting campaign activation tests...");
  
  // Simple validation without Jest
  async function runSimpleTest() {
    try {
      await mongoose.connect(TEST_CONFIG.MONGODB_URI);
      console.log("✅ Connected to test database");

      // Create test data
      const testOrganizationId = new mongoose.Types.ObjectId();
      const testCampaign = await Campaign.create({
        name: "Simple Test Campaign",
        organization_id: testOrganizationId,
        createdBy: new mongoose.Types.ObjectId(),
        isActive: false,
        status: "draft",
        messagesList: [
          {
            id: 1,
            message: "Test message",
            nextContactHourInterval: 24
          }
        ]
      });

      await CampaignLeads.create({
        name: "Test Lead",
        phoneNumber: "+1234567890",
        campaign_id: testCampaign._id,
        organization_id: testOrganizationId,
        status: "active",
        contactAttempts: 0
      });

      console.log("📋 Test data created");

      // Test activation
      console.log("🧪 Testing campaign activation...");
      const result = await campaignsService.toggleCampaignStatus(testCampaign._id, true);
      
      if (result.isActive && result.status === "active") {
        console.log("✅ Campaign activation successful");
        console.log("⏳ Waiting for immediate processing...");
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log("✅ Immediate processing trigger test completed");
      } else {
        console.log("❌ Campaign activation failed");
      }

      // Clean up
      await Campaign.findByIdAndDelete(testCampaign._id);
      await CampaignLeads.deleteMany({ campaign_id: testCampaign._id });
      
      await mongoose.disconnect();
      console.log("✅ Test completed and cleaned up");

    } catch (error) {
      console.error("❌ Test failed:", error);
      process.exit(1);
    }
  }

  runSimpleTest();
}