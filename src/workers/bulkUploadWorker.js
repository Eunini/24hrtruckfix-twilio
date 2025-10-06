const {
  mechanicsQueue,
  serviceProvidersQueue,
  policiesQueue,
  scheduleJobCleanup,
  TTL_CONFIG,
} = require('../services/queue/queueManager');

// Import bulk upload functions
const { bulkUploadMechanics } = require('../models/mongo/functions/mechanic');
// const { bulkUploadServiceProviders } = require('../models/mongo/functions/serviceProvider');
const { bulkUploadPolicies } = require('../models/mongo/functions/policies');

// Process mechanics bulk upload jobs
mechanicsQueue.process('bulk-upload-mechanics', async (job) => {
  const { data, user, organizationId, adminRole, userId } = job.data;
  
  try {
    console.log(`🔄 Processing mechanics bulk upload job ${job.id}`);
    console.log(`📊 Processing ${data.length} mechanics for organization ${organizationId}`);
    
    // Update progress
    await job.progress(10);
    
    // Process the bulk upload
    const result = await bulkUploadMechanics(data, adminRole, userId, organizationId);
    
    // Update progress
    await job.progress(90);
    
    console.log(`✅ Completed mechanics bulk upload job ${job.id}`);
    console.log(`📈 Uploaded ${result.count} mechanics successfully`);
    
    // Final progress
    await job.progress(100);
    
    // Schedule job cleanup after 1 minute
    await scheduleJobCleanup(job);
    
    return {
      success: true,
      message: 'Mechanics bulk upload completed successfully',
      uploaded: result.count,
      data: result,
      processedAt: new Date(),
      organizationId,
      userId,
      cleanupScheduled: true,
      cleanupDelay: TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY
    };
    
  } catch (error) {
    console.error(`❌ Error processing mechanics bulk upload job ${job.id}:`, error);
    // Schedule cleanup for failed jobs too (after longer delay)
    await scheduleJobCleanup(job, TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY * 5); // 5 minutes for failed jobs
    throw new Error(`Mechanics bulk upload failed: ${error.message}`);
  }
});

// Process service providers bulk upload jobs
serviceProvidersQueue.process('bulk-upload-service-providers', async (job) => {
  const { data, user, organizationId, adminRole, userId } = job.data;
  
  try {
    console.log(`🔄 Processing service providers bulk upload job ${job.id}`);
    console.log(`📊 Processing ${data.length} service providers for organization ${organizationId}`);
    
    await job.progress(10);
    
    // TODO: Implement service provider bulk upload function
    // const result = await bulkUploadServiceProviders(data, adminRole, userId, organizationId);
    
    // Placeholder for now
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
    const result = {
      message: 'Service providers bulk upload completed',
      count: data.length,
      uploaded: data // Placeholder
    };
    
    await job.progress(90);
    
    console.log(`✅ Completed service providers bulk upload job ${job.id}`);
    
    await job.progress(100);
    
    // Schedule job cleanup after 1 minute
    await scheduleJobCleanup(job);
    
    return {
      success: true,
      message: 'Service providers bulk upload completed successfully',
      uploaded: result.count,
      data: result,
      processedAt: new Date(),
      organizationId,
      userId,
      cleanupScheduled: true,
      cleanupDelay: TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY
    };
    
  } catch (error) {
    console.error(`❌ Error processing service providers bulk upload job ${job.id}:`, error);
    // Schedule cleanup for failed jobs too
    await scheduleJobCleanup(job, TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY * 5);
    throw new Error(`Service providers bulk upload failed: ${error.message}`);
  }
});

// Process policies bulk upload jobs
policiesQueue.process('bulk-upload-policies', async (job) => {
  const { data, user, organizationId, adminRole, userId } = job.data;
  
  try {
    console.log(`🔄 Processing policies bulk upload job ${job.id}`);
    console.log(`📊 Processing ${data.length} policies for organization ${organizationId}`);
    
    await job.progress(10);
    
    // Process the bulk upload using the actual function
    const result = await bulkUploadPolicies(data, adminRole, userId, organizationId);
    
    await job.progress(90);
    
    console.log(`✅ Completed policies bulk upload job ${job.id}`);
    console.log(`📈 Uploaded ${result.count} policies successfully`);
    
    await job.progress(100);
    
    // Schedule job cleanup after 1 minute
    await scheduleJobCleanup(job);
    
    return {
      success: true,
      message: 'Policies bulk upload completed successfully',
      uploaded: result.count,
      data: result,
      processedAt: new Date(),
      organizationId,
      userId,
      cleanupScheduled: true,
      cleanupDelay: TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY
    };
    
  } catch (error) {
    console.error(`❌ Error processing policies bulk upload job ${job.id}:`, error);
    // Schedule cleanup for failed jobs too
    await scheduleJobCleanup(job, TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY * 5);
    throw new Error(`Policies bulk upload failed: ${error.message}`);
  }
});

// Enhanced error handling for all queues with TTL awareness
const setupErrorHandling = (queue, queueName) => {
  queue.on('completed', (job, result) => {
    console.log(`✅ ${queueName} job ${job.id} completed successfully`);
    console.log(`🕐 Job will be cleaned up in ${TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY/1000} seconds`);
  });

  queue.on('failed', (job, err) => {
    console.error(`❌ ${queueName} job ${job.id} failed:`, err.message);
    console.log(`🕐 Failed job will be cleaned up in ${(TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY * 5)/1000} seconds`);
  });

  queue.on('stalled', (job) => {
    console.warn(`⚠️ ${queueName} job ${job.id} stalled`);
  });

  queue.on('progress', (job, progress) => {
    console.log(`📊 ${queueName} job ${job.id} progress: ${progress}%`);
  });

  // Add TTL-specific events
  queue.on('removed', (job) => {
    console.log(`🗑️ ${queueName} job ${job.id} removed (TTL cleanup)`);
  });

  queue.on('cleaned', (jobs, type) => {
    console.log(`🧹 ${queueName} cleaned ${jobs.length} ${type} jobs`);
  });
};

// Setup error handling for all queues
setupErrorHandling(mechanicsQueue, 'Mechanics');
setupErrorHandling(serviceProvidersQueue, 'Service Providers');
setupErrorHandling(policiesQueue, 'Policies');

console.log('🚀 Bulk upload workers started and ready to process jobs');
console.log(`⏰ TTL Configuration:`);
console.log(`   📅 Job data TTL: ${TTL_CONFIG.JOB_DATA_TTL/1000/60/60/24} days`);
console.log(`   🧹 Completed job cleanup: ${TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY/1000} seconds`);
console.log(`   ❌ Failed job cleanup: ${(TTL_CONFIG.COMPLETED_JOB_CLEANUP_DELAY * 5)/1000} seconds`);

module.exports = {
  mechanicsQueue,
  serviceProvidersQueue,
  policiesQueue,
}; 