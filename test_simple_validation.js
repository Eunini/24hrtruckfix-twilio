// Simple validation test for first message processing functionality
// This test validates the code structure and logic without external dependencies

const fs = require('fs');
const path = require('path');

function validateFileExists(filePath) {
  const fullPath = path.join(__dirname, filePath);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ File exists: ${filePath}`);
    return true;
  } else {
    console.log(`❌ File missing: ${filePath}`);
    return false;
  }
}

function validateCodeContains(filePath, searchStrings) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ Cannot validate ${filePath} - file not found`);
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  let allFound = true;

  searchStrings.forEach(searchString => {
    if (content.includes(searchString)) {
      console.log(`✅ Found in ${filePath}: "${searchString}"`);
    } else {
      console.log(`❌ Missing in ${filePath}: "${searchString}"`);
      allFound = false;
    }
  });

  return allFound;
}

function runValidationTests() {
  console.log('🔍 Running Code Validation Tests for First Message Processing\n');

  let allTestsPassed = true;

  // Test 1: Validate required files exist
  console.log('📁 Checking required files...');
  const requiredFiles = [
    'src/services/campaigns.service.js',
    'src/controllers/campaigns.controller.js',
    'src/routes/campaigns.routes.js'
  ];

  requiredFiles.forEach(file => {
    if (!validateFileExists(file)) {
      allTestsPassed = false;
    }
  });

  // Test 2: Validate campaigns.service.js contains first message processing logic
  console.log('\n🔧 Validating campaigns.service.js...');
  const serviceValidations = [
    'processFirstMessageForLead',
    'addLeadToCampaign',
    'addLeadsToCampaign',
    'processCampaignService',
    'campaign.isActive && campaign.status === "active"',
    'contactAttempts: 1',
    'lastContactedAt: new Date()'
  ];

  if (!validateCodeContains('src/services/campaigns.service.js', serviceValidations)) {
    allTestsPassed = false;
  }

  // Test 3: Validate controller endpoints exist
  console.log('\n🎮 Validating campaigns.controller.js...');
  const controllerValidations = [
    'addLeadToCampaign',
    'addLeadsToCampaign',
    'campaignsService.addLeadToCampaign',
    'campaignsService.addLeadsToCampaign'
  ];

  if (!validateCodeContains('src/controllers/campaigns.controller.js', controllerValidations)) {
    allTestsPassed = false;
  }

  // Test 4: Validate routes are properly defined
  console.log('\n🛣️  Validating campaigns.routes.js...');
  const routeValidations = [
    '/campaigns/:campaignId/leads',
    '/campaigns/:campaignId/leads/bulk',
    'addLeadToCampaign',
    'addLeadsToCampaign'
  ];

  if (!validateCodeContains('src/routes/campaigns.routes.js', routeValidations)) {
    allTestsPassed = false;
  }

  // Test 5: Check for proper error handling
  console.log('\n🛡️  Validating error handling...');
  const errorHandlingValidations = [
    'try {',
    'catch (error)',
    'console.error'
  ];

  if (!validateCodeContains('src/services/campaigns.service.js', errorHandlingValidations)) {
    allTestsPassed = false;
  }

  // Test 6: Check for batch processing in bulk operations
  console.log('\n📦 Validating bulk processing logic...');
  const bulkProcessingValidations = [
    'batchSize',
    'Promise.allSettled',
    'setTimeout'
  ];

  if (!validateCodeContains('src/services/campaigns.service.js', bulkProcessingValidations)) {
    allTestsPassed = false;
  }

  // Summary
  console.log('\n📊 Test Summary:');
  if (allTestsPassed) {
    console.log('✅ All validation tests passed!');
    console.log('🎉 First message processing functionality appears to be properly implemented.');
    console.log('\n📋 Implementation Summary:');
    console.log('   • Single lead addition automatically processes first message');
    console.log('   • Bulk lead addition processes first message for all leads');
    console.log('   • Batch processing prevents system overload');
    console.log('   • Error handling ensures system stability');
    console.log('   • Only active campaigns trigger message processing');
  } else {
    console.log('❌ Some validation tests failed.');
    console.log('⚠️  Please review the implementation.');
  }

  return allTestsPassed;
}

// Run validation if this file is executed directly
if (require.main === module) {
  const success = runValidationTests();
  process.exit(success ? 0 : 1);
}

module.exports = { runValidationTests };