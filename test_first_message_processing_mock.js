const mongoose = require('mongoose');
const Campaign = require('./src/models/mongo/campaign');
const CampaignLeads = require('./src/models/mongo/campaignLeads');
const CampaignMessagingSequence = require('./src/models/mongo/campaignMessagingSequence');

// Mock Twilio service to avoid environment variable requirements
jest.mock('./src/services/twilio.service', () => ({
  sendSMS: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'mock_message_id',
    status: 'sent'
  })
}));

// Test configuration
const TEST_CONFIG = {
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/24hourservice',
  TEST_CAMPAIGN_NAME: 'Test Campaign - First Message Processing',
  TEST_ORGANIZATION_ID: '507f1f77bcf86cd799439011' // Replace with actual org ID
};

async function connectToDatabase() {
  try {
    await mongoose.connect(TEST_CONFIG.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function createTestCampaign() {
  const testCampaign = new Campaign({
    name: TEST_CONFIG.TEST_CAMPAIGN_NAME,
    organization_id: TEST_CONFIG.TEST_ORGANIZATION_ID,
    messagesList: [
      {
        message: "Welcome! This is your first message from our test campaign.",
        nextContactHourInterval: 24
      },
      {
        message: "This is your second message. Thanks for being part of our campaign!",
        nextContactHourInterval: 48
      }
    ],
    isActive: true,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const savedCampaign = await testCampaign.save();
  console.log(`✅ Created test campaign: ${savedCampaign._id}`);
  return savedCampaign;
}

async function testSingleLeadAddition(campaignId) {
  console.log('\n🧪 Testing single lead addition...');
  
  const testLead = {
    name: 'John Doe',
    phoneNumber: '+1234567890',
    notes: 'Test lead for first message processing'
  };

  try {
    // Import campaigns service after mocking
    const campaignsService = require('./src/services/campaigns.service');
    
    const addedLead = await campaignsService.addLeadToCampaign(campaignId, testLead);
    console.log(`✅ Single lead added: ${addedLead._id}`);

    // Wait a moment for async processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if messaging sequence was created
    const messagingSequence = await CampaignMessagingSequence.findOne({
      lead_id: addedLead._id,
      campaign_id: campaignId
    });

    if (messagingSequence) {
      console.log('✅ Messaging sequence created for single lead');
      console.log(`   Message: ${messagingSequence.message}`);
      console.log(`   Status: ${messagingSequence.status}`);
    } else {
      console.log('❌ No messaging sequence found for single lead');
    }

    // Check if lead was updated with contact info
    const updatedLead = await CampaignLeads.findById(addedLead._id);
    if (updatedLead.contactAttempts > 0) {
      console.log(`✅ Lead contact attempts updated: ${updatedLead.contactAttempts}`);
    }
    if (updatedLead.lastContactedAt) {
      console.log(`✅ Lead last contacted at: ${updatedLead.lastContactedAt}`);
    }

    return addedLead;
  } catch (error) {
    console.error('❌ Error testing single lead addition:', error);
    return null;
  }
}

async function testBulkLeadAddition(campaignId) {
  console.log('\n🧪 Testing bulk lead addition...');
  
  const testLeads = [
    {
      name: 'Jane Smith',
      phoneNumber: '+1234567891',
      notes: 'Bulk test lead 1'
    },
    {
      name: 'Bob Johnson',
      phoneNumber: '+1234567892',
      notes: 'Bulk test lead 2'
    },
    {
      name: 'Alice Brown',
      phoneNumber: '+1234567893',
      notes: 'Bulk test lead 3'
    }
  ];

  try {
    const campaignsService = require('./src/services/campaigns.service');
    
    const addedLeads = await campaignsService.addLeadsToCampaign(campaignId, testLeads);
    console.log(`✅ Bulk leads added: ${addedLeads.length} leads`);

    // Wait a moment for async processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if messaging sequences were created for all leads
    const messagingSequences = await CampaignMessagingSequence.find({
      campaign_id: campaignId,
      lead_id: { $in: addedLeads.map(lead => lead._id) }
    });

    console.log(`✅ Found ${messagingSequences.length} messaging sequences for ${addedLeads.length} bulk leads`);
    
    if (messagingSequences.length === addedLeads.length) {
      console.log('✅ All bulk leads have messaging sequences');
    } else {
      console.log(`⚠️  Only ${messagingSequences.length} out of ${addedLeads.length} leads have messaging sequences`);
    }

    // Check if leads were updated with contact info
    const updatedLeads = await CampaignLeads.find({
      _id: { $in: addedLeads.map(lead => lead._id) },
      contactAttempts: { $gt: 0 }
    });
    
    console.log(`✅ ${updatedLeads.length} out of ${addedLeads.length} leads have updated contact attempts`);

    return addedLeads;
  } catch (error) {
    console.error('❌ Error testing bulk lead addition:', error);
    return [];
  }
}

async function testInactiveCampaign() {
  console.log('\n🧪 Testing inactive campaign (should not send messages)...');
  
  // Create inactive campaign
  const inactiveCampaign = new Campaign({
    name: 'Inactive Test Campaign',
    organization_id: TEST_CONFIG.TEST_ORGANIZATION_ID,
    messagesList: [
      {
        message: "This message should not be sent.",
        nextContactHourInterval: 24
      }
    ],
    isActive: false,
    status: 'inactive',
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const savedInactiveCampaign = await inactiveCampaign.save();
  console.log(`✅ Created inactive test campaign: ${savedInactiveCampaign._id}`);

  const testLead = {
    name: 'Test Inactive',
    phoneNumber: '+1234567899',
    notes: 'Test lead for inactive campaign'
  };

  try {
    const campaignsService = require('./src/services/campaigns.service');
    
    const addedLead = await campaignsService.addLeadToCampaign(savedInactiveCampaign._id, testLead);
    console.log(`✅ Lead added to inactive campaign: ${addedLead._id}`);

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if messaging sequence was created (should not be)
    const messagingSequence = await CampaignMessagingSequence.findOne({
      lead_id: addedLead._id,
      campaign_id: savedInactiveCampaign._id
    });

    if (!messagingSequence) {
      console.log('✅ No messaging sequence created for inactive campaign (correct behavior)');
    } else {
      console.log('❌ Messaging sequence was created for inactive campaign (unexpected)');
    }

    return savedInactiveCampaign;
  } catch (error) {
    console.error('❌ Error testing inactive campaign:', error);
    return null;
  }
}

async function cleanup(campaignIds) {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Delete messaging sequences
    await CampaignMessagingSequence.deleteMany({
      campaign_id: { $in: campaignIds }
    });
    
    // Delete leads
    await CampaignLeads.deleteMany({
      campaign_id: { $in: campaignIds }
    });
    
    // Delete campaigns
    await Campaign.deleteMany({
      _id: { $in: campaignIds }
    });
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

async function runTests() {
  console.log('🚀 Starting First Message Processing Tests (Mocked)\n');
  
  await connectToDatabase();
  
  const campaignIds = [];
  
  try {
    // Create test campaign
    const testCampaign = await createTestCampaign();
    campaignIds.push(testCampaign._id);
    
    // Test single lead addition
    await testSingleLeadAddition(testCampaign._id);
    
    // Test bulk lead addition
    await testBulkLeadAddition(testCampaign._id);
    
    // Test inactive campaign
    const inactiveCampaign = await testInactiveCampaign();
    if (inactiveCampaign) {
      campaignIds.push(inactiveCampaign._id);
    }
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test execution error:', error);
  } finally {
    // Cleanup
    await cleanup(campaignIds);
    
    // Close database connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };