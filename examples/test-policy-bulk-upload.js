/**
 * Test Script for Policy Bulk Upload
 * 
 * This script demonstrates how to use the background worker system
 * for bulk uploading policies.
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/v1';
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token

// Sample policy data
const samplePolicies = [
  {
    policy_number: "POL-2024-001",
    insured_first_name: "John",
    insured_last_name: "Doe",
    insured_middle_initial: "M",
    policy_effective_date: "01/01/2024",
    policy_expiration_date: "01/01/2025",
    agency_name: "ABC Insurance Agency",
    risk_address_line_1: "123 Main St",
    risk_address_city: "Anytown",
    risk_address_state: "CA",
    risk_address_zip_code: "12345",
    vehicle_manufacturer: "Ford",
    vehicle_model: "F-150",
    vehicle_model_year: "2023",
    vehicle_vin: "1FTFW1ET5DFC12345",
    vehicle_color: "Blue",
    licensePlate: "ABC123",
    vehicles: [
      {
        vehicle_manufacturer: "Ford",
        vehicle_model: "F-150",
        vehicle_model_year: "2023",
        vehicle_vin: "1FTFW1ET5DFC12345",
        vehicle_color: "Blue",
        licensePlate: "ABC123"
      }
    ]
  },
  {
    policy_number: "POL-2024-002",
    insured_first_name: "Jane",
    insured_last_name: "Smith",
    policy_effective_date: "02/01/2024",
    policy_expiration_date: "02/01/2025",
    agency_name: "XYZ Insurance",
    risk_address_line_1: "456 Oak Ave",
    risk_address_city: "Springfield",
    risk_address_state: "IL",
    risk_address_zip_code: "62701",
    vehicle_manufacturer: "Chevrolet",
    vehicle_model: "Silverado",
    vehicle_model_year: "2022",
    vehicle_vin: "1GCUYDED5NZ123456",
    vehicle_color: "Red",
    licensePlate: "XYZ789"
  },
  {
    policy_number: "POL-2024-003",
    insured_first_name: "Bob",
    insured_last_name: "Johnson",
    policy_effective_date: "03/01/2024",
    policy_expiration_date: "03/01/2025",
    agency_name: "DEF Insurance Co",
    risk_address_line_1: "789 Pine Rd",
    risk_address_city: "Madison",
    risk_address_state: "WI",
    risk_address_zip_code: "53703",
    vehicle_manufacturer: "Ram",
    vehicle_model: "1500",
    vehicle_model_year: "2024",
    vehicle_vin: "1C6SRFFT0PN123789",
    vehicle_color: "White",
    licensePlate: "DEF456"
  }
];

// Helper function to make API requests
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

// Main test function
const testPolicyBulkUpload = async () => {
  try {
    console.log('🚀 Starting Policy Bulk Upload Test...\n');

    // Step 1: Submit bulk upload job
    console.log('📤 Submitting bulk upload job...');
    const uploadResponse = await apiRequest('POST', '/bulk-upload/policies', samplePolicies);
    
    console.log('✅ Bulk upload job submitted successfully!');
    console.log('📋 Job Details:');
    console.log(`   Job ID: ${uploadResponse.data.jobId}`);
    console.log(`   Queue: ${uploadResponse.data.queueName}`);
    console.log(`   Status: ${uploadResponse.data.status}`);
    console.log(`   Total Records: ${uploadResponse.data.totalRecords}`);
    console.log(`   Estimated Time: ${uploadResponse.data.estimatedProcessingTime}`);
    console.log(`   Status URL: ${uploadResponse.data.statusCheckUrl}\n`);

    const { jobId, queueName } = uploadResponse.data;

    // Step 2: Monitor job progress
    console.log('👀 Monitoring job progress...');
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max

    while (!jobCompleted && attempts < maxAttempts) {
      attempts++;
      
      try {
        const statusResponse = await apiRequest('GET', `/jobs/${queueName}/${jobId}/status`);
        const { status, progress, result, error } = statusResponse.data;

        console.log(`📊 Attempt ${attempts}: Status = ${status}, Progress = ${progress}%`);

        if (status === 'completed') {
          jobCompleted = true;
          console.log('\n🎉 Job completed successfully!');
          console.log('📈 Results:');
          console.log(`   Uploaded: ${result.uploaded} policies`);
          console.log(`   Message: ${result.message}`);
          
          if (result.data && result.data.summary) {
            console.log('📊 Summary:');
            console.log(`   Total: ${result.data.summary.total}`);
            console.log(`   Successful: ${result.data.summary.successful}`);
            console.log(`   Failed: ${result.data.summary.failed}`);
            console.log(`   Success Rate: ${result.data.summary.successRate}`);
          }

          if (result.data && result.data.failed && result.data.failed.length > 0) {
            console.log('\n❌ Failed Policies:');
            result.data.failed.forEach((failure, index) => {
              console.log(`   ${index + 1}. ${failure.policy_number}: ${failure.error}`);
            });
          }
          
        } else if (status === 'failed') {
          console.log(`\n❌ Job failed: ${error}`);
          break;
        } else if (status === 'active') {
          console.log(`   ⚡ Job is actively processing...`);
        }

        // Wait 10 seconds before next check
        if (!jobCompleted) {
          await new Promise(resolve => setTimeout(resolve, 10000));
        }

      } catch (error) {
        console.error(`❌ Error checking job status:`, error.message);
        break;
      }
    }

    if (!jobCompleted && attempts >= maxAttempts) {
      console.log('\n⏰ Timeout: Job is taking longer than expected');
      console.log('💡 You can continue monitoring using:');
      console.log(`   GET ${API_BASE_URL}/jobs/${queueName}/${jobId}/status`);
    }

    // Step 3: Check queue statistics
    console.log('\n📊 Checking queue statistics...');
    try {
      const statsResponse = await apiRequest('GET', '/queues/stats');
      console.log('📈 Queue Statistics:');
      
      Object.entries(statsResponse.data.queues).forEach(([queueName, stats]) => {
        if (stats.error) {
          console.log(`   ${queueName}: Error - ${stats.error}`);
        } else {
          console.log(`   ${queueName}:`);
          console.log(`     Waiting: ${stats.waiting}`);
          console.log(`     Active: ${stats.active}`);
          console.log(`     Completed: ${stats.completed}`);
          console.log(`     Failed: ${stats.failed}`);
          console.log(`     Total: ${stats.total}`);
        }
      });
    } catch (error) {
      console.error('❌ Error getting queue stats:', error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
if (require.main === module) {
  console.log('🧪 Policy Bulk Upload Test Script');
  console.log('=====================================\n');
  
  if (JWT_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    console.log('❌ Please update the JWT_TOKEN in this script with a valid token');
    process.exit(1);
  }

  testPolicyBulkUpload()
    .then(() => {
      console.log('\n✅ Test completed!');
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = {
  testPolicyBulkUpload,
  samplePolicies
}; 