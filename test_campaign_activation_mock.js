const mongoose = require("mongoose");

// Mock the Twilio service before requiring other modules
const mockTwilioService = {
  sendSMS: async (phoneNumber, message) => {
    console.log(`📱 Mock SMS sent to ${phoneNumber}: ${message}`);
    return {
      success: true,
      sid: "mock_message_sid_" + Date.now(),
      status: "sent",
      to: phoneNumber,
      body: message
    };
  }
};

// Replace the actual twilio service with our mock
require.cache[require.resolve("./src/services/twilio.service")] = {
  exports: mockTwilioService,
  loaded: true,
  id: require.resolve("./src/services/twilio.service")
};

// Now require the other modules
const Campaign = require("./src/models/campaign.model");
const CampaignLeads = require("./src/models/campaignLeads.model");
const CampaignMessagingSequence = require("./src/models/campaignMessagingSequence.model");
const campaignsService = require("./src/services/campaigns.service");

// Test configuration
const TEST_CONFIG = {
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/24hourservice_test",
  TEST_TIMEOUT: 10000
};

async function runCampaignActivationTest() {
  let testCampaign;
  let testOrganizationId;

  try {
    console.log("🚀 Starting campaign activation immediate processing test...");
    
    // Connect to database
    await mongoose.connect(TEST_CONFIG.MONGODB_URI);
    console.log("✅ Connected to test database");

    // Create test organization ID
    testOrganizationId = new mongoose.Types.ObjectId();

    // Create test campaign
    testCampaign = await Campaign.create({
      name: "Test Campaign for Activation Processing",
      organization_id: testOrganizationId,
      createdBy: new mongoose.Types.ObjectId(),
      isActive: false,
      status: "draft",
      messagesList: [
        {
          id: 1,
          message: "Hello! This is your first message from our test campaign. Welcome aboard!",
          nextContactHourInterval: 24
        },
        {
          id: 2,
          message: "This is a follow-up message to check how you're doing.",
          nextContactHourInterval: 48
        }
      ]
    });

    console.log(`📋 Created test campaign: ${testCampaign._id}`);

    // Add test leads to the campaign
    const testLeads = await CampaignLeads.create([
      {
        name: "John Doe",
        phoneNumber: "+1234567890",
        campaign_id: testCampaign._id,
        organization_id: testOrganizationId,
        status: "active",
        contactAttempts: 0
      },
      {
        name: "Jane Smith", 
        phoneNumber: "+1234567891",
        campaign_id: testCampaign._id,
        organization_id: testOrganizationId,
        status: "active",
        contactAttempts: 0
      },
      {
        name: "Bob Johnson",
        phoneNumber: "+1234567892",
        campaign_id: testCampaign._id,
        organization_id: testOrganizationId,
        status: "active",
        contactAttempts: 0
      }
    ]);

    console.log(`👥 Added ${testLeads.length} test leads to campaign`);

    // Get initial state of leads
    const initialLeads = await CampaignLeads.find({ campaign_id: testCampaign._id });
    console.log("📊 Initial lead states:");
    initialLeads.forEach(lead => {
      console.log(`  - ${lead.name}: contactAttempts=${lead.contactAttempts}, lastContactedAt=${lead.lastContactedAt}`);
    });

    // Test 1: Activate the campaign
    console.log("\n🧪 TEST 1: Activating campaign...");
    const activatedCampaign = await campaignsService.toggleCampaignStatus(testCampaign._id, true);

    // Verify campaign is activated
    if (activatedCampaign.isActive && activatedCampaign.status === "active") {
      console.log("✅ Campaign successfully activated");
    } else {
      throw new Error("Campaign activation failed");
    }

    // Wait for immediate processing to complete
    console.log("⏳ Waiting for immediate processing to complete...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if leads were processed
    const processedLeads = await CampaignLeads.find({ campaign_id: testCampaign._id });
    console.log("\n📊 Lead states after activation:");
    
    let leadsProcessed = 0;
    processedLeads.forEach(lead => {
      console.log(`  - ${lead.name}: contactAttempts=${lead.contactAttempts}, lastContactedAt=${lead.lastContactedAt}`);
      if (lead.contactAttempts > 0) {
        leadsProcessed++;
      }
    });

    // Check messaging sequences created
    const messagingSequences = await CampaignMessagingSequence.find({ campaign_id: testCampaign._id });
    console.log(`\n📨 Messaging sequences created: ${messagingSequences.length}`);
    
    messagingSequences.forEach(seq => {
      console.log(`  - Sequence ${seq.sequenceOrder}: ${seq.status}, scheduled for ${seq.nextScheduledAt}`);
    });

    // Validate results
    if (leadsProcessed > 0) {
      console.log(`\n✅ SUCCESS: ${leadsProcessed} leads were processed immediately upon campaign activation`);
    } else {
      console.log("\n⚠️  WARNING: No leads were processed - this might indicate an issue");
    }

    if (messagingSequences.length > 0) {
      console.log(`✅ SUCCESS: ${messagingSequences.length} messaging sequences were created`);
    } else {
      console.log("⚠️  WARNING: No messaging sequences were created");
    }

    // Test 2: Deactivate and reactivate
    console.log("\n🧪 TEST 2: Testing deactivation and reactivation...");
    
    // Deactivate
    await campaignsService.toggleCampaignStatus(testCampaign._id, false);
    console.log("📴 Campaign deactivated");
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reactivate
    await campaignsService.toggleCampaignStatus(testCampaign._id, true);
    console.log("🔄 Campaign reactivated");
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check final state
    const finalLeads = await CampaignLeads.find({ campaign_id: testCampaign._id });
    const finalSequences = await CampaignMessagingSequence.find({ campaign_id: testCampaign._id });
    
    console.log(`\n📊 Final results: ${finalSequences.length} total sequences created`);
    
    console.log("\n🎉 Campaign activation immediate processing test completed successfully!");

  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  } finally {
    // Clean up test data
    if (testCampaign) {
      console.log("\n🧹 Cleaning up test data...");
      await Campaign.findByIdAndDelete(testCampaign._id);
      await CampaignLeads.deleteMany({ campaign_id: testCampaign._id });
      await CampaignMessagingSequence.deleteMany({ campaign_id: testCampaign._id });
      console.log("✅ Test data cleaned up");
    }
    
    // Disconnect from database
    await mongoose.disconnect();
    console.log("✅ Disconnected from database");
  }
}

// Run the test
if (require.main === module) {
  runCampaignActivationTest()
    .then(() => {
      console.log("\n🎯 All tests completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Test suite failed:", error);
      process.exit(1);
    });
}

module.exports = { runCampaignActivationTest };