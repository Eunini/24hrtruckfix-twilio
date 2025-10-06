/**
 * Test Script for Policy Upsert Upgrade with Email Notifications
 * 
 * This script demonstrates the new policy upsert functionality:
 * 1. Setting shouldUpsertPolicies flag for organizations
 * 2. Bulk uploading policies with upsert mode
 * 3. Monitoring the batch processing
 * 4. Testing email notifications
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

// Sample policy data for testing
const generateSamplePolicies = (count = 2500) => {
  const policies = [];
  
  for (let i = 1; i <= count; i++) {
    policies.push({
      policy_number: `UPSERT-POL-2024-${String(i).padStart(6, '0')}`,
      insured_first_name: `TestFirst${i}`,
      insured_last_name: `TestLast${i}`,
      insured_middle_initial: "T",
      policy_effective_date: "01/01/2024",
      policy_expiration_date: "01/01/2025",
      agency_name: "Test Upsert Agency",
      risk_address_line_1: `${i} Test Street`,
      risk_address_city: "Test City",
      risk_address_state: "CA",
      risk_address_zip_code: "12345",
      vehicle_manufacturer: i % 2 === 0 ? "Ford" : "Chevrolet",
      vehicle_model: i % 2 === 0 ? "F-150" : "Silverado",
      vehicle_model_year: "2023",
      vehicle_vin: `TEST${String(i).padStart(13, '0')}`,
      vehicle_color: i % 3 === 0 ? "Blue" : i % 3 === 1 ? "Red" : "White",
      licensePlate: `TST${String(i).padStart(4, '0')}`,
      vehicles: [
        {
          vehicle_manufacturer: i % 2 === 0 ? "Ford" : "Chevrolet",
          vehicle_model: i % 2 === 0 ? "F-150" : "Silverado",
          vehicle_model_year: "2023",
          vehicle_vin: `TEST${String(i).padStart(13, '0')}`,
          vehicle_color: i % 3 === 0 ? "Blue" : i % 3 === 1 ? "Red" : "White",
          licensePlate: `TST${String(i).padStart(4, '0')}`
        }
      ]
    });
  }
  
  return policies;
};

// Helper function to wait for job completion
const waitForJobCompletion = async (queueName, jobId, maxAttempts = 60) => {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      const statusResponse = await apiRequest('GET', `/jobs/${queueName}/${jobId}/status`);
      const { status, progress, result, error } = statusResponse.data;

      console.log(`   📊 Attempt ${attempts}: Status = ${status}, Progress = ${progress}%`);

      if (status === 'completed') {
        console.log('   ✅ Job completed successfully!');
        return result;
      } else if (status === 'failed') {
        console.log(`   ❌ Job failed: ${error}`);
        throw new Error(`Job failed: ${error}`);
      }

      // Wait 10 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 10000));

    } catch (error) {
      console.error(`   ❌ Error checking job status:`, error.message);
      throw error;
    }
  }
  
  throw new Error('Job did not complete within expected time');
};

// Test email notification functionality
const testEmailNotifications = async () => {
  try {
    console.log('📧 Testing Email Notification System...\n');

    const organizationId = 'YOUR_ORGANIZATION_ID_HERE'; // Replace with actual organization ID
    const userId = 'YOUR_USER_ID_HERE'; // Replace with actual user ID

    // Test 1: Send upload started notification
    console.log('📋 Test 1: Testing upload started notification...');
    try {
      const startedResult = await apiRequest('POST', '/notifications/policy-upload/started', {
        userId,
        organizationId,
        jobInfo: {
          jobId: 'test-job-123',
          totalRecords: 1000,
          estimatedProcessingTime: '5 minutes',
          mode: 'upsert'
        }
      });
      console.log(`   ✅ Started notification: ${startedResult.success ? 'Sent' : 'Failed'}`);
      if (!startedResult.success) {
        console.log(`   ❌ Error: ${startedResult.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Started notification failed: ${error.message}`);
    }

    // Test 2: Send upload completion notification (success)
    console.log('\n📋 Test 2: Testing upload completion notification (success)...');
    try {
      const completionResult = await apiRequest('POST', '/notifications/policy-upload/completed', {
        userId,
        organizationId,
        uploadResult: {
          message: "Policies bulk upload completed",
          mode: "upsert",
          summary: {
            total: 1000,
            successful: 950,
            failed: 50,
            successRate: "95.00%",
            processingTime: "3.5 minutes"
          },
          successful: Array.from({length: 950}, (_, i) => ({
            policy_number: `TEST-POL-${i + 1}`,
            id: `policy_id_${i + 1}`,
            success: true
          })),
          failed: Array.from({length: 50}, (_, i) => ({
            policy_number: `FAILED-POL-${i + 1}`,
            error: 'Sample error message',
            success: false
          })),
          organizationId,
          processedAt: new Date(),
          jobId: 'test-job-123'
        }
      });
      console.log(`   ✅ Completion notification: ${completionResult.success ? 'Sent' : 'Failed'}`);
      if (!completionResult.success) {
        console.log(`   ❌ Error: ${completionResult.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Completion notification failed: ${error.message}`);
    }

    // Test 3: Send upload completion notification (failure)
    console.log('\n📋 Test 3: Testing upload completion notification (failure)...');
    try {
      const failureResult = await apiRequest('POST', '/notifications/policy-upload/completed', {
        userId,
        organizationId,
        uploadResult: {
          message: "Policies bulk upload failed",
          mode: "individual",
          summary: {
            total: 100,
            successful: 0,
            failed: 100,
            successRate: "0.00%",
            processingTime: "0.5 minutes"
          },
          failed: [
            {
              policy_number: 'N/A',
              error: 'Database connection failed',
              success: false
            }
          ],
          organizationId,
          processedAt: new Date(),
          jobId: 'test-job-failed-456'
        }
      });
      console.log(`   ✅ Failure notification: ${failureResult.success ? 'Sent' : 'Failed'}`);
      if (!failureResult.success) {
        console.log(`   ❌ Error: ${failureResult.error}`);
      }
    } catch (error) {
      console.log(`   ❌ Failure notification failed: ${error.message}`);
    }

    console.log('\n🎉 Email notification testing completed!');

  } catch (error) {
    console.error('❌ Email notification test failed:', error.message);
  }
};

// Main test function with email notifications
const testPolicyUpsertUpgradeWithEmails = async () => {
  try {
    console.log('🚀 Starting Policy Upsert Upgrade Test with Email Notifications...\n');

    const organizationId = 'YOUR_ORGANIZATION_ID_HERE'; // Replace with actual organization ID

    // Step 1: Check current upsert setting
    console.log('📋 Step 1: Checking current upsert setting...');
    const currentSetting = await apiRequest('GET', `/organizations/${organizationId}/upsert-policies`);
    console.log(`   Current setting: ${currentSetting.shouldUpsertPolicies ? 'ENABLED' : 'DISABLED'}\n`);

    // Step 2: Enable upsert mode
    console.log('📋 Step 2: Enabling upsert mode...');
    const enableResult = await apiRequest('PUT', `/organizations/${organizationId}/upsert-policies`, {
      shouldUpsert: true
    });
    console.log(`   ✅ ${enableResult.message}`);
    console.log(`   Upsert mode: ${enableResult.shouldUpsertPolicies ? 'ENABLED' : 'DISABLED'}\n`);

    // Step 3: Generate test policies
    console.log('📋 Step 3: Generating test policies...');
    const testPolicies = generateSamplePolicies(100); // Smaller set for testing
    console.log(`   Generated ${testPolicies.length} test policies\n`);

    // Step 4: Submit policies with upsert mode and email notifications
    console.log('📋 Step 4: Submitting policies with upsert mode and email notifications...');
    const uploadResponse = await apiRequest('POST', '/bulk-upload/policies', {
      policies: testPolicies,
      sendNotifications: true // Enable email notifications
    });
    
    console.log('✅ Upsert batch submitted successfully!');
    console.log(`   Job ID: ${uploadResponse.data.jobId}`);
    console.log(`   Mode: Upsert (will delete all existing and batch insert)`);
    console.log(`   Total Records: ${uploadResponse.data.totalRecords}`);
    console.log(`   Email Notifications: ENABLED`);
    console.log(`   Estimated Time: ${uploadResponse.data.estimatedProcessingTime}\n`);

    // Step 5: Monitor upsert job progress
    console.log('👀 Monitoring upsert job progress...');
    console.log('   📧 You should receive an email notification that the upload has started...');
    
    const upsertResult = await waitForJobCompletion(
      uploadResponse.data.queueName, 
      uploadResponse.data.jobId
    );

    // Step 6: Display results
    console.log('\n🎉 Upsert test completed!');
    console.log('📧 You should receive an email notification with the completion results...');
    console.log('📊 Final Results:');
    console.log(`   Mode: ${upsertResult.mode || 'upsert'}`);
    console.log(`   Total Processed: ${upsertResult.summary.total}`);
    console.log(`   Successful: ${upsertResult.summary.successful}`);
    console.log(`   Failed: ${upsertResult.summary.failed}`);
    console.log(`   Success Rate: ${upsertResult.summary.successRate}`);
    console.log(`   Processing Time: ${upsertResult.summary.processingTime}`);

    if (upsertResult.failed && upsertResult.failed.length > 0) {
      console.log('\n❌ Failed Policies (first 5):');
      upsertResult.failed.slice(0, 5).forEach((failure, index) => {
        console.log(`   ${index + 1}. ${failure.policy_number}: ${failure.error}`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Test bulk organization upsert setting
const testBulkOrganizationUpsert = async () => {
  try {
    console.log('\n🔧 Testing bulk organization upsert setting...\n');

    const organizationIds = [
      'ORG_ID_1', // Replace with actual organization IDs
      'ORG_ID_2',
      'ORG_ID_3'
    ];

    // Enable upsert for multiple organizations
    console.log('📋 Enabling upsert mode for multiple organizations...');
    const bulkEnableResult = await apiRequest('PUT', '/organizations/bulk/upsert-policies', {
      organizationIds,
      shouldUpsert: true
    });

    console.log(`   ✅ ${bulkEnableResult.message}`);
    console.log(`   Modified: ${bulkEnableResult.result.modifiedCount} organizations`);
    console.log(`   Matched: ${bulkEnableResult.result.matchedCount} organizations\n`);

    // Later disable for all
    console.log('📋 Disabling upsert mode for multiple organizations...');
    const bulkDisableResult = await apiRequest('PUT', '/organizations/bulk/upsert-policies', {
      organizationIds,
      shouldUpsert: false
    });

    console.log(`   ✅ ${bulkDisableResult.message}`);
    console.log(`   Modified: ${bulkDisableResult.result.modifiedCount} organizations`);

  } catch (error) {
    console.error('❌ Bulk test failed:', error.message);
  }
};

// Performance comparison test
const testPerformanceComparison = async () => {
  try {
    console.log('\n⚡ Performance Comparison Test...\n');

    const organizationId = 'YOUR_ORGANIZATION_ID_HERE';
    const testPolicies = generateSamplePolicies(1000);

    // Test 1: Individual mode
    console.log('📋 Test 1: Individual validation mode...');
    await apiRequest('PUT', `/organizations/${organizationId}/upsert-policies`, { shouldUpsert: false });
    
    const individualStart = Date.now();
    const individualResponse = await apiRequest('POST', '/bulk-upload/policies', {
      policies: testPolicies,
      sendNotifications: false // Disable for performance testing
    });
    const individualResult = await waitForJobCompletion(
      individualResponse.data.queueName, 
      individualResponse.data.jobId
    );
    const individualTime = Date.now() - individualStart;

    console.log(`   ⏱️  Individual mode: ${individualTime}ms`);
    console.log(`   📊 Success rate: ${individualResult.summary.successRate}`);

    // Test 2: Upsert mode
    console.log('\n📋 Test 2: Upsert batch mode...');
    await apiRequest('PUT', `/organizations/${organizationId}/upsert-policies`, { shouldUpsert: true });
    
    const upsertStart = Date.now();
    const upsertResponse = await apiRequest('POST', '/bulk-upload/policies', {
      policies: testPolicies,
      sendNotifications: false // Disable for performance testing
    });
    const upsertResult = await waitForJobCompletion(
      upsertResponse.data.queueName, 
      upsertResponse.data.jobId
    );
    const upsertTime = Date.now() - upsertStart;

    console.log(`   ⏱️  Upsert mode: ${upsertTime}ms`);
    console.log(`   📊 Success rate: ${upsertResult.summary.successRate}`);

    // Performance summary
    console.log('\n📈 Performance Summary:');
    console.log(`   Individual mode: ${(individualTime / 1000).toFixed(2)}s`);
    console.log(`   Upsert mode: ${(upsertTime / 1000).toFixed(2)}s`);
    console.log(`   Performance improvement: ${((individualTime - upsertTime) / individualTime * 100).toFixed(2)}%`);

  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
  }
};

// Export functions for use in other scripts
module.exports = {
  testPolicyUpsertUpgradeWithEmails,
  testEmailNotifications,
  testBulkOrganizationUpsert,
  testPerformanceComparison,
  generateSamplePolicies,
  apiRequest,
  waitForJobCompletion
};

// Run the tests if this file is executed directly
if (require.main === module) {
  console.log('🧪 Policy Upsert Upgrade Test Suite with Email Notifications\n');
  console.log('⚠️  Make sure to update the following before running:');
  console.log('   - JWT_TOKEN: Your authentication token');
  console.log('   - organizationId: Valid organization ID');
  console.log('   - userId: Valid user ID (for email notifications)');
  console.log('   - API_BASE_URL: Your API base URL');
  console.log('   - Ensure email configuration is set up in the backend\n');
  
  // Uncomment the test you want to run:
  // testPolicyUpsertUpgradeWithEmails();
  // testEmailNotifications();
  // testBulkOrganizationUpsert();
  // testPerformanceComparison();
} 