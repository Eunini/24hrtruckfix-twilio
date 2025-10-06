/**
 * Test Script for Organization AI Setup Upgrade
 * 
 * This script demonstrates the new organization approval functionality:
 * 1. Approving an organization automatically triggers AI setup
 * 2. Purchasing a Twilio phone number
 * 3. Creating VAPI inbound and outbound assistants
 * 4. Registering phone number with VAPI
 * 5. Saving AI configuration to database
 * 6. Sending approval email to organization owner
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/v1';
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token

// Helper function for API requests
const apiRequest = async (method, endpoint, data = null) => {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`API Error (${method} ${endpoint}):`, error.response?.data || error.message);
    throw error;
  }
};

// Test organization approval with AI setup
const testOrganizationApproval = async () => {
  try {
    console.log('🚀 Testing Organization Approval with AI Setup...\n');

    const organizationId = 'YOUR_ORGANIZATION_ID_HERE'; // Replace with actual organization ID

    // Step 1: Check current organization status
    console.log('📋 Step 1: Checking current organization status...');
    try {
      const orgStatus = await apiRequest('GET', `/organizations/${organizationId}/ai-status`);
      console.log(`   Current Status: ${orgStatus.organization.status}`);
      console.log(`   Is Verified: ${orgStatus.organization.isVerified}`);
      console.log(`   Has AI Setup: ${orgStatus.aiSetup.hasSetup}`);
      
      if (orgStatus.aiSetup.hasSetup) {
        console.log(`   Phone Number: ${orgStatus.aiSetup.phoneNumber}`);
        console.log(`   Setup Date: ${orgStatus.aiSetup.setupDate}`);
      }
    } catch (error) {
      console.log(`   ❌ Error checking status: ${error.message}`);
    }

    // Step 2: Approve organization (this will trigger AI setup)
    console.log('\n📋 Step 2: Approving organization (triggering AI setup)...');
    const approvalResult = await apiRequest('POST', `/organizations/${organizationId}/verify`, {
      status: 'verified',
      countryCode: 'US',
      areaCode: '510' // Optional: specify area code preference
    });

    console.log(`   ✅ ${approvalResult.message}`);
    console.log(`   Organization Status: ${approvalResult.data.organization.status}`);
    console.log(`   Is Verified: ${approvalResult.data.organization.isVerified}`);

    if (approvalResult.data.aiSetup) {
      const aiSetup = approvalResult.data.aiSetup;
      console.log(`   AI Setup Success: ${aiSetup.success}`);
      
      if (aiSetup.success) {
        console.log(`   Setup Time: ${aiSetup.setupTime}`);
        console.log(`   Phone Number: ${aiSetup.data.phoneNumber}`);
        console.log(`   Inbound Assistant: ${aiSetup.data.assistants.inbound.name} (${aiSetup.data.assistants.inbound.id})`);
        console.log(`   Outbound Assistant: ${aiSetup.data.assistants.outbound.name} (${aiSetup.data.assistants.outbound.id})`);
        console.log(`   Email Sent: ${aiSetup.data.emailSent ? 'Yes' : 'No'}`);
      } else {
        console.log(`   ❌ AI Setup Failed: ${aiSetup.error}`);
        console.log(`   Failed at step: ${aiSetup.step}`);
      }
    }

    // Step 3: Verify AI setup status
    console.log('\n📋 Step 3: Verifying AI setup status...');
    const finalStatus = await apiRequest('GET', `/organizations/${organizationId}/ai-status`);
    
    console.log('📊 Final Organization Status:');
    console.log(`   Organization: ${finalStatus.organization.companyName || 'N/A'}`);
    console.log(`   Status: ${finalStatus.organization.status}`);
    console.log(`   Verified: ${finalStatus.organization.isVerified}`);
    console.log(`   Has AI Setup: ${finalStatus.aiSetup.hasSetup}`);
    
    if (finalStatus.aiSetup.hasSetup) {
      console.log(`   Setup Completed: ${finalStatus.aiSetup.setupCompleted}`);
      console.log(`   AI Status: ${finalStatus.aiSetup.status}`);
      console.log(`   Phone Number: ${finalStatus.aiSetup.phoneNumber}`);
      console.log(`   Inbound Assistant ID: ${finalStatus.aiSetup.assistants.inbound}`);
      console.log(`   Outbound Assistant ID: ${finalStatus.aiSetup.assistants.outbound}`);
      console.log(`   Setup Date: ${new Date(finalStatus.aiSetup.setupDate).toLocaleString()}`);
    }

    console.log('\n🎉 Organization approval and AI setup test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Test AI setup retry functionality
const testAISetupRetry = async () => {
  try {
    console.log('\n🔄 Testing AI Setup Retry...\n');

    const organizationId = 'YOUR_ORGANIZATION_ID_HERE'; // Replace with actual organization ID

    console.log('📋 Retrying AI setup for organization...');
    const retryResult = await apiRequest('POST', `/organizations/${organizationId}/retry-ai-setup`, {
      countryCode: 'US',
      areaCode: '415' // Different area code for retry
    });

    console.log(`   ✅ ${retryResult.message}`);
    console.log(`   Retry Success: ${retryResult.success}`);
    
    if (retryResult.success && retryResult.data.aiSetup) {
      const aiSetup = retryResult.data.aiSetup;
      console.log(`   Setup Time: ${aiSetup.setupTime}`);
      console.log(`   Phone Number: ${aiSetup.data.phoneNumber}`);
      console.log(`   Email Sent: ${aiSetup.data.emailSent ? 'Yes' : 'No'}`);
    } else if (retryResult.data.aiSetup) {
      console.log(`   ❌ Retry Failed: ${retryResult.data.aiSetup.error}`);
    }

  } catch (error) {
    console.error('❌ Retry test failed:', error.message);
  }
};

// Test AI setup cleanup functionality
const testAISetupCleanup = async () => {
  try {
    console.log('\n🧹 Testing AI Setup Cleanup...\n');

    const organizationId = 'YOUR_ORGANIZATION_ID_HERE'; // Replace with actual organization ID

    console.log('📋 Cleaning up AI setup for organization...');
    const cleanupResult = await apiRequest('DELETE', `/organizations/${organizationId}/ai-setup`);

    console.log(`   ✅ ${cleanupResult.message}`);
    console.log(`   Cleanup Success: ${cleanupResult.success}`);
    
    if (cleanupResult.success && cleanupResult.data.cleanup) {
      const cleanup = cleanupResult.data.cleanup.results;
      console.log('   Cleanup Results:');
      console.log(`     Phone Number Released: ${cleanup.phoneNumberReleased ? 'Yes' : 'No'}`);
      console.log(`     Inbound Assistant Deleted: ${cleanup.inboundAssistantDeleted ? 'Yes' : 'No'}`);
      console.log(`     Outbound Assistant Deleted: ${cleanup.outboundAssistantDeleted ? 'Yes' : 'No'}`);
      console.log(`     VAPI Phone Number Deleted: ${cleanup.vapiPhoneNumberDeleted ? 'Yes' : 'No'}`);
      console.log(`     Config Deleted: ${cleanup.configDeleted ? 'Yes' : 'No'}`);
    }

  } catch (error) {
    console.error('❌ Cleanup test failed:', error.message);
  }
};

// Test creating a new organization and approving it
const testFullOrganizationFlow = async () => {
  try {
    console.log('\n🏢 Testing Full Organization Flow...\n');

    // Step 1: Create a new organization
    console.log('📋 Step 1: Creating new organization...');
    const newOrgData = {
      clientId: 'YOUR_CLIENT_ID_HERE', // Replace with actual client ID
      orgType: 'service_provider',
      companyName: 'Test AI Setup Company',
      businessType: 'Automotive Service',
      address: '123 Test Street, Test City, CA 12345'
    };

    const createResult = await apiRequest('POST', '/organizations', newOrgData);
    console.log(`   ✅ Organization created: ${createResult._id}`);
    console.log(`   Company: ${createResult.companyName || 'N/A'}`);
    console.log(`   Status: ${createResult.status}`);

    const newOrgId = createResult._id;

    // Step 2: Approve the organization (triggers AI setup)
    console.log('\n📋 Step 2: Approving new organization...');
    const approvalResult = await apiRequest('POST', `/organizations/${newOrgId}/verify`, {
      status: 'verified',
      countryCode: 'US',
      areaCode: '650'
    });

    console.log(`   ✅ ${approvalResult.message}`);
    
    if (approvalResult.data.aiSetup && approvalResult.data.aiSetup.success) {
      console.log('   🤖 AI Setup Details:');
      console.log(`     Phone Number: ${approvalResult.data.aiSetup.data.phoneNumber}`);
      console.log(`     Inbound Assistant: ${approvalResult.data.aiSetup.data.assistants.inbound.name}`);
      console.log(`     Outbound Assistant: ${approvalResult.data.aiSetup.data.assistants.outbound.name}`);
      console.log(`     Setup Time: ${approvalResult.data.aiSetup.setupTime}`);
    }

    // Step 3: Test the AI configuration
    console.log('\n📋 Step 3: Testing AI configuration...');
    const aiStatus = await apiRequest('GET', `/organizations/${newOrgId}/ai-status`);
    
    if (aiStatus.aiSetup.hasSetup) {
      console.log('   ✅ AI Configuration Active:');
      console.log(`     Phone: ${aiStatus.aiSetup.phoneNumber}`);
      console.log(`     Status: ${aiStatus.aiSetup.status}`);
      console.log(`     Setup Completed: ${aiStatus.aiSetup.setupCompleted}`);
    } else {
      console.log('   ❌ AI Configuration not found');
    }

    console.log('\n🎉 Full organization flow test completed!');
    console.log(`📝 New Organization ID: ${newOrgId}`);

  } catch (error) {
    console.error('❌ Full flow test failed:', error.message);
  }
};

// Test environment variables and configuration
const testConfiguration = async () => {
  try {
    console.log('🔧 Testing Configuration...\n');

    // Test email notification
    console.log('📧 Testing email configuration...');
    try {
      const emailTest = await apiRequest('GET', '/notifications/test?email=test@example.com');
      console.log(`   ✅ Email test: ${emailTest.success ? 'Passed' : 'Failed'}`);
      if (!emailTest.success) {
        console.log(`   ❌ Email error: ${emailTest.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Email test failed: ${error.message}`);
    }

    console.log('\n📋 Required Environment Variables:');
    const requiredVars = [
      'VAPI_API_KEY',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'SERVER_URL',
      'FROM_EMAIL'
    ];

    requiredVars.forEach(varName => {
      const isSet = process.env[varName] ? '✅' : '❌';
      console.log(`   ${isSet} ${varName}`);
    });

  } catch (error) {
    console.error('❌ Configuration test failed:', error.message);
  }
};

// Export functions for use in other scripts
module.exports = {
  testOrganizationApproval,
  testAISetupRetry,
  testAISetupCleanup,
  testFullOrganizationFlow,
  testConfiguration,
  apiRequest
};

// Run the tests if this file is executed directly
if (require.main === module) {
  console.log('🧪 Organization AI Setup Test Suite\n');
  console.log('⚠️  Make sure to update the following before running:');
  console.log('   - JWT_TOKEN: Your authentication token');
  console.log('   - organizationId: Valid organization ID for testing');
  console.log('   - clientId: Valid client ID for new organization creation');
  console.log('   - API_BASE_URL: Your API base URL');
  console.log('   - Environment variables: VAPI_API_KEY, TWILIO credentials, etc.\n');
  
  // Uncomment the test you want to run:
  // testConfiguration();
  // testOrganizationApproval();
  // testAISetupRetry();
  // testAISetupCleanup();
  // testFullOrganizationFlow();
} 