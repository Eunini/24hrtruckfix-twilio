/**
 * Test Script for TTL Functionality in Bulk Upload System
 * 
 * This script demonstrates the TTL (Time To Live) features:
 * - 3-day TTL on job data
 * - 1-minute cleanup after job completion
 * - Manual cleanup operations
 * - TTL configuration monitoring
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/v1';
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token

// Sample data for testing
const sampleMechanics = [
  {
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    mobileNumber: "1234567890",
    specialization: "Engine Repair"
  },
  {
    firstName: "Jane",
    lastName: "Smith", 
    email: "jane.smith@example.com",
    mobileNumber: "0987654321",
    specialization: "Transmission"
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

// Test TTL configuration
const testTTLConfiguration = async () => {
  console.log('📋 Testing TTL Configuration...');
  
  try {
    const response = await apiRequest('GET', '/jobs/ttl/config');
    
    console.log('✅ TTL Configuration retrieved successfully!');
    console.log('⏰ TTL Settings:');
    console.log(`   📅 Job Data TTL: ${response.data.ttlConfiguration.jobDataTtl.days} days`);
    console.log(`   🧹 Completed Job Cleanup: ${response.data.ttlConfiguration.completedJobCleanup.minutes} minutes`);
    console.log(`   ❌ Failed Job TTL: ${response.data.ttlConfiguration.failedJobTtl.days} days`);
    
    console.log('\n🎯 Features:');
    Object.entries(response.data.features).forEach(([feature, enabled]) => {
      console.log(`   ${enabled ? '✅' : '❌'} ${feature}`);
    });
    
    console.log('\n📝 Descriptions:');
    Object.entries(response.data.description).forEach(([key, desc]) => {
      console.log(`   • ${desc}`);
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get TTL configuration:', error.message);
    throw error;
  }
};

// Test job submission with TTL tracking
const testJobSubmissionWithTTL = async () => {
  console.log('\n📤 Testing Job Submission with TTL Tracking...');
  
  try {
    const response = await apiRequest('POST', '/bulk-upload/mechanics', sampleMechanics);
    
    console.log('✅ Job submitted successfully!');
    console.log(`📋 Job ID: ${response.data.jobId}`);
    console.log(`🔄 Status: ${response.data.status}`);
    console.log(`📊 Total Records: ${response.data.totalRecords}`);
    
    return {
      jobId: response.data.jobId,
      queueName: response.data.queueName
    };
  } catch (error) {
    console.error('❌ Failed to submit job:', error.message);
    throw error;
  }
};

// Test job status with TTL information
const testJobStatusWithTTL = async (queueName, jobId) => {
  console.log('\n🔍 Testing Job Status with TTL Information...');
  
  try {
    const response = await apiRequest('GET', `/jobs/${queueName}/${jobId}/status`);
    
    console.log('✅ Job status retrieved successfully!');
    console.log(`📋 Job ID: ${response.data.jobId}`);
    console.log(`🔄 Status: ${response.data.status}`);
    console.log(`📊 Progress: ${response.data.progress}%`);
    
    if (response.data.ttl) {
      console.log('\n⏰ TTL Information:');
      console.log(`   📅 Total TTL: ${response.data.ttl.totalHours} hours`);
      console.log(`   ⏳ Remaining: ${response.data.ttl.remainingHours} hours`);
      console.log(`   📆 Expires At: ${new Date(response.data.ttl.expiresAt).toLocaleString()}`);
      console.log(`   ❌ Is Expired: ${response.data.ttl.isExpired}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get job status:', error.message);
    throw error;
  }
};

// Test queue statistics with TTL config
const testQueueStatsWithTTL = async () => {
  console.log('\n📊 Testing Queue Statistics with TTL Config...');
  
  try {
    const response = await apiRequest('GET', '/queues/stats');
    
    console.log('✅ Queue statistics retrieved successfully!');
    
    Object.entries(response.data.queues).forEach(([queueName, stats]) => {
      if (stats.error) {
        console.log(`❌ ${queueName}: Error - ${stats.error}`);
      } else {
        console.log(`\n📈 ${queueName}:`);
        console.log(`   ⏳ Waiting: ${stats.waiting}`);
        console.log(`   🔄 Active: ${stats.active}`);
        console.log(`   ✅ Completed: ${stats.completed}`);
        console.log(`   ❌ Failed: ${stats.failed}`);
        console.log(`   📊 Total: ${stats.total}`);
        
        if (stats.ttlConfig) {
          console.log(`   ⏰ TTL Config:`);
          console.log(`     📅 Job Data TTL: ${stats.ttlConfig.jobDataTtlDays} days`);
          console.log(`     🧹 Cleanup Delay: ${stats.ttlConfig.completedJobCleanupMinutes} minutes`);
          console.log(`     ❌ Failed TTL: ${stats.ttlConfig.failedJobTtlDays} days`);
        }
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to get queue statistics:', error.message);
    throw error;
  }
};

// Test manual cleanup
const testManualCleanup = async () => {
  console.log('\n🧹 Testing Manual Cleanup...');
  
  try {
    const response = await apiRequest('POST', '/jobs/cleanup');
    
    console.log('✅ Manual cleanup completed successfully!');
    console.log(`🗑️ Cleaned Jobs: ${response.data.cleanedJobs}`);
    console.log(`👤 Triggered By: ${response.data.triggeredBy}`);
    console.log(`📅 Triggered At: ${new Date(response.data.triggeredAt).toLocaleString()}`);
    
    console.log('\n⏰ TTL Configuration:');
    console.log(`   📅 Job Data TTL: ${response.data.ttlConfig.jobDataTtlDays} days`);
    console.log(`   🧹 Cleanup Delay: ${response.data.ttlConfig.completedJobCleanupMinutes} minutes`);
    console.log(`   ❌ Failed Job TTL: ${response.data.ttlConfig.failedJobTtlDays} days`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to trigger manual cleanup:', error.message);
    throw error;
  }
};

// Monitor job completion and cleanup
const monitorJobCleanup = async (queueName, jobId) => {
  console.log('\n👀 Monitoring Job Completion and Cleanup...');
  
  let jobCompleted = false;
  let attempts = 0;
  const maxAttempts = 20; // 10 minutes max
  
  while (!jobCompleted && attempts < maxAttempts) {
    attempts++;
    
    try {
      const statusResponse = await apiRequest('GET', `/jobs/${queueName}/${jobId}/status`);
      const { status, progress, ttl } = statusResponse.data;
      
      console.log(`📊 Attempt ${attempts}: Status = ${status}, Progress = ${progress}%`);
      
      if (ttl) {
        console.log(`   ⏳ TTL Remaining: ${ttl.remainingHours} hours`);
      }
      
      if (status === 'completed') {
        jobCompleted = true;
        console.log('\n🎉 Job completed! Monitoring cleanup...');
        
        // Wait for cleanup (1 minute + buffer)
        console.log('⏰ Waiting 90 seconds for automatic cleanup...');
        await new Promise(resolve => setTimeout(resolve, 90000));
        
        // Check if job still exists
        try {
          await apiRequest('GET', `/jobs/${queueName}/${jobId}/status`);
          console.log('⚠️ Job still exists after cleanup delay');
        } catch (error) {
          if (error.response?.status === 404) {
            console.log('✅ Job successfully cleaned up!');
          } else {
            console.log('❓ Unexpected error checking job status:', error.message);
          }
        }
        
      } else if (status === 'failed') {
        console.log(`\n❌ Job failed`);
        break;
      }
      
      // Wait 30 seconds before next check
      if (!jobCompleted) {
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
      
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Job not found - likely cleaned up');
        break;
      } else {
        console.error(`❌ Error checking job status:`, error.message);
        break;
      }
    }
  }
  
  if (!jobCompleted && attempts >= maxAttempts) {
    console.log('\n⏰ Timeout: Job monitoring exceeded maximum time');
  }
};

// Main test function
const testTTLFunctionality = async () => {
  try {
    console.log('🧪 TTL Functionality Test Suite');
    console.log('================================\n');
    
    // Test 1: Get TTL Configuration
    await testTTLConfiguration();
    
    // Test 2: Submit job with TTL tracking
    const jobInfo = await testJobSubmissionWithTTL();
    
    // Test 3: Check job status with TTL info
    await testJobStatusWithTTL(jobInfo.queueName, jobInfo.jobId);
    
    // Test 4: Get queue statistics with TTL config
    await testQueueStatsWithTTL();
    
    // Test 5: Monitor job completion and cleanup
    await monitorJobCleanup(jobInfo.queueName, jobInfo.jobId);
    
    // Test 6: Manual cleanup
    await testManualCleanup();
    
    console.log('\n✅ All TTL functionality tests completed!');
    
  } catch (error) {
    console.error('\n❌ TTL functionality test failed:', error.message);
  }
};

// Run the test
if (require.main === module) {
  console.log('🧪 TTL Functionality Test Script');
  console.log('=================================\n');
  
  if (JWT_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    console.log('❌ Please update the JWT_TOKEN in this script with a valid token');
    process.exit(1);
  }
  
  testTTLFunctionality()
    .then(() => {
      console.log('\n✅ Test suite completed!');
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = {
  testTTLFunctionality,
  testTTLConfiguration,
  testJobSubmissionWithTTL,
  testJobStatusWithTTL,
  testQueueStatsWithTTL,
  testManualCleanup,
  monitorJobCleanup
}; 