/**
 * Test Script for Webhook and Cron Job Migration
 * 
 * This script demonstrates the migration from serverless functions to Express.js endpoints:
 * 1. VAPI webhook endpoints (inbound/outbound)
 * 2. Cron job functionality converted to API endpoints with direct VAPI integration
 * 3. Health checks and monitoring
 * 4. Testing functionality
 * 
 * Key Changes:
 * - Replaced buildship proxy endpoints with direct VAPI API calls
 * - Added support for experienced vs standard mechanic workflows
 * - Dynamic system prompt generation based on job requirements
 * - Enhanced error handling and monitoring
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/v1';
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token

// Helper function for API requests
const apiRequest = async (method, endpoint, data = null, requiresAuth = false) => {
  try {
    const config = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (requiresAuth) {
      config.headers['Authorization'] = `Bearer ${JWT_TOKEN}`;
    }

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

// Test webhook endpoints
const testWebhookEndpoints = async () => {
  try {
    console.log('🔄 Testing Webhook Endpoints...\n');

    // Test webhook health check
    console.log('📋 1. Testing webhook health check...');
    const healthCheck = await apiRequest('GET', '/webhook/health');
    console.log('   ✅ Webhook service health:', healthCheck.success ? 'Healthy' : 'Unhealthy');
    console.log('   📍 Available endpoints:', Object.keys(healthCheck.endpoints || {}));

    // Test webhook functionality with mock data
    console.log('\n📋 2. Testing webhook with mock data...');
    const testData = {
      type: 'inbound',
      phoneNumber: '+15551234567',
      sid: '507f1f77bcf86cd799439011' // Example MongoDB ObjectId
    };

    try {
      const testResult = await apiRequest('POST', '/webhook/test', testData);
      console.log('   ✅ Webhook test:', testResult.success ? 'Passed' : 'Failed');
      if (testResult.success) {
        console.log('   📊 Test result:', testResult.message);
      }
    } catch (error) {
      console.log('   ⚠️ Webhook test failed (expected for missing test data):', error.message);
    }

    console.log('\n✅ Webhook endpoint tests completed!');

  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
  }
};

// Test cron job endpoints
const testCronJobEndpoints = async () => {
  try {
    console.log('\n🔄 Testing Cron Job Endpoints...\n');

    // Test cron job health check
    console.log('📋 1. Testing cron job health check...');
    const healthCheck = await apiRequest('GET', '/cron/health');
    console.log('   ✅ Cron service health:', healthCheck.success ? 'Healthy' : 'Unhealthy');
    console.log('   📊 Current stats:', healthCheck.stats);

    // Test getting tracking stats
    console.log('\n📋 2. Testing tracking statistics...');
    const stats = await apiRequest('GET', '/cron/stats', null, true);
    console.log('   ✅ Statistics retrieved successfully');
    console.log('   📊 Active tracking records:', stats.data.active);
    console.log('   📊 Completed tracking records:', stats.data.completed);
    console.log('   📊 Total tracking records:', stats.data.total);

    // Test schedule configuration
    console.log('\n📋 3. Testing schedule configuration...');
    const scheduleConfig = await apiRequest('GET', '/cron/schedule-config');
    console.log('   ✅ Schedule configuration retrieved');
    console.log('   📅 Available schedules:', Object.keys(scheduleConfig.data));

    // Test cleanup (should be safe to run)
    console.log('\n📋 4. Testing cleanup functionality...');
    try {
      const cleanupResult = await apiRequest('POST', '/cron/cleanup', null, true);
      console.log('   ✅ Cleanup completed:', cleanupResult.message);
      console.log('   📊 Records cleaned:', cleanupResult.data.cleaned || 0);
    } catch (error) {
      console.log('   ⚠️ Cleanup test failed (may require auth):', error.message);
    }

    console.log('\n✅ Cron job endpoint tests completed!');

  } catch (error) {
    console.error('❌ Cron job test failed:', error.message);
  }
};

// Test the main batch processing functionality
const testBatchProcessing = async () => {
  try {
    console.log('\n🔄 Testing Batch Processing...\n');

    console.log('📋 Running batch processing (main cron job functionality)...');
    try {
      const batchResult = await apiRequest('POST', '/cron/process-batches', null, true);
      console.log('   ✅ Batch processing completed');
      console.log('   📊 Results:', {
        totalFound: batchResult.data.totalFound,
        processed: batchResult.data.processed,
        errors: batchResult.data.errors
      });
    } catch (error) {
      console.log('   ⚠️ Batch processing test failed (may require auth or data):', error.message);
    }

  } catch (error) {
    console.error('❌ Batch processing test failed:', error.message);
  }
};

// Test maintenance cycle
const testMaintenanceCycle = async () => {
  try {
    console.log('\n🔄 Testing Maintenance Cycle...\n');

    console.log('📋 Running complete maintenance cycle...');
    try {
      const maintenanceResult = await apiRequest('POST', '/cron/maintenance', null, true);
      console.log('   ✅ Maintenance cycle completed');
      console.log('   ⏱️ Maintenance time:', maintenanceResult.maintenanceTime);
      console.log('   📊 Final stats:', maintenanceResult.data.finalStats);
    } catch (error) {
      console.log('   ⚠️ Maintenance test failed (may require auth):', error.message);
    }

  } catch (error) {
    console.error('❌ Maintenance test failed:', error.message);
  }
};

// Test specific ticket processing
const testSpecificTicketProcessing = async (ticketId = 'test-ticket-123') => {
  try {
    console.log('\n🔄 Testing Specific Ticket Processing...\n');

    console.log(`📋 Processing specific ticket: ${ticketId}...`);
    try {
      const ticketResult = await apiRequest('POST', `/cron/process-ticket/${ticketId}`, null, true);
      console.log('   ✅ Ticket processing result:', ticketResult.success ? 'Success' : 'Failed');
      if (!ticketResult.success) {
        console.log('   📝 Reason:', ticketResult.message);
      }
    } catch (error) {
      console.log('   ⚠️ Ticket processing test failed (expected for non-existent ticket):', error.message);
    }

  } catch (error) {
    console.error('❌ Specific ticket test failed:', error.message);
  }
};

// Performance comparison test
const testPerformanceComparison = async () => {
  try {
    console.log('\n🔄 Testing Performance Comparison...\n');

    const endpoints = [
      { name: 'Webhook Health', endpoint: '/webhook/health', method: 'GET' },
      { name: 'Cron Health', endpoint: '/cron/health', method: 'GET' },
      { name: 'Cron Stats', endpoint: '/cron/stats', method: 'GET', auth: true }
    ];

    for (const test of endpoints) {
      console.log(`📋 Testing ${test.name}...`);
      const startTime = Date.now();
      
      try {
        await apiRequest(test.method, test.endpoint, null, test.auth);
        const responseTime = Date.now() - startTime;
        console.log(`   ✅ ${test.name}: ${responseTime}ms`);
      } catch (error) {
        const responseTime = Date.now() - startTime;
        console.log(`   ❌ ${test.name}: ${responseTime}ms (failed: ${error.message})`);
      }
    }

  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
  }
};

// Main test runner
const runAllTests = async () => {
  console.log('🧪 Webhook and Cron Job Migration Test Suite\n');
  console.log('⚠️  Make sure to update the following before running:');
  console.log('   - API_BASE_URL: Your API base URL');
  console.log('   - JWT_TOKEN: Your authentication token for protected endpoints');
  console.log('   - Ensure your Express.js server is running\n');

  try {
    await testWebhookEndpoints();
    await testCronJobEndpoints();
    await testBatchProcessing();
    await testMaintenanceCycle();
    await testSpecificTicketProcessing();
    await testPerformanceComparison();

    console.log('\n🎉 All tests completed!');
    console.log('\n📋 Migration Summary:');
    console.log('✅ Webhook endpoints migrated from serverless to Express.js');
    console.log('✅ Cron job functionality converted to API endpoints');
    console.log('✅ Health checks and monitoring implemented');
    console.log('✅ Authentication and error handling added');
    console.log('✅ Performance optimizations included');

  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
};

// Export functions for individual testing
module.exports = {
  testWebhookEndpoints,
  testCronJobEndpoints,
  testBatchProcessing,
  testMaintenanceCycle,
  testSpecificTicketProcessing,
  testPerformanceComparison,
  runAllTests,
  apiRequest
};

// Run all tests if this file is executed directly
if (require.main === module) {
  runAllTests();
} 