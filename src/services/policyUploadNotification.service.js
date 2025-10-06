const { 
  sendPolicyUploadCompletionEmail, 
  sendPolicyUploadStartedEmail 
} = require('./mail/policyUploadCompletionMail');
const UserModel = require('../models/user.model');
const OrganizationModel = require('../models/organization.model');

/**
 * Send policy upload started notification
 * @param {string} userId - User ID who initiated the upload
 * @param {string} organizationId - Organization ID
 * @param {Object} jobInfo - Job information
 * @returns {Promise<Object>} Result of email sending
 */
const sendUploadStartedNotification = async (userId, organizationId, jobInfo) => {
  try {
    // Fetch user and organization information
    const userInfo = await UserModel.findById(userId).select('firstname lastname email');
    const organizationInfo = await OrganizationModel.findById(organizationId).select('companyName owner');
    
    // If user email is not available, try to get owner's email
    let emailRecipient = userInfo;
    if (!userInfo?.email && organizationInfo?.owner) {
      const ownerInfo = await UserModel.findById(organizationInfo.owner).select('email firstname lastname');
      if (ownerInfo?.email) {
        emailRecipient = ownerInfo;
      }
    }

    if (!emailRecipient?.email) {
      console.warn('⚠️ No email address found for upload started notification');
      return { success: false, error: 'No email address available' };
    }

    const result = await sendPolicyUploadStartedEmail(
      emailRecipient.email,
      jobInfo,
      organizationInfo || { companyName: 'Unknown Organization' },
      emailRecipient
    );

    console.log(`📧 Upload started notification sent to ${emailRecipient.email}`);
    return result;

  } catch (error) {
    console.error('❌ Error sending upload started notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send policy upload completion notification
 * @param {string} userId - User ID who initiated the upload
 * @param {string} organizationId - Organization ID
 * @param {Object} uploadResult - Upload result data
 * @returns {Promise<Object>} Result of email sending
 */
const sendUploadCompletionNotification = async (userId, organizationId, uploadResult) => {
  try {
    // Fetch user and organization information
    const userInfo = await UserModel.findById(userId).select('firstname lastname email');
    const organizationInfo = await OrganizationModel.findById(organizationId).select('companyName owner');
    
    // If user email is not available, try to get owner's email
    let emailRecipient = userInfo;
    if (!userInfo?.email && organizationInfo?.owner) {
      const ownerInfo = await UserModel.findById(organizationInfo.owner).select('email firstname lastname');
      if (ownerInfo?.email) {
        emailRecipient = ownerInfo;
      }
    }

    if (!emailRecipient?.email) {
      console.warn('⚠️ No email address found for upload completion notification');
      return { success: false, error: 'No email address available' };
    }

    const result = await sendPolicyUploadCompletionEmail(
      emailRecipient.email,
      uploadResult,
      organizationInfo || { companyName: 'Unknown Organization' },
      emailRecipient
    );

    console.log(`📧 Upload completion notification sent to ${emailRecipient.email}`);
    return result;

  } catch (error) {
    console.error('❌ Error sending upload completion notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send bulk upload notifications for background workers
 * @param {Object} jobData - Job data containing user, organization, and result information
 * @param {string} type - Notification type: 'started' or 'completed'
 * @returns {Promise<Object>} Result of email sending
 */
const sendBulkUploadNotification = async (jobData, type = 'completed') => {
  try {
    const { userId, organizationId, result, jobInfo } = jobData;

    if (type === 'started') {
      return await sendUploadStartedNotification(userId, organizationId, jobInfo);
    } else if (type === 'completed') {
      return await sendUploadCompletionNotification(userId, organizationId, result);
    } else {
      throw new Error(`Invalid notification type: ${type}`);
    }

  } catch (error) {
    console.error(`❌ Error sending ${type} notification:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to multiple recipients (e.g., admin and user)
 * @param {Array<string>} userIds - Array of user IDs to notify
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Notification data (result or jobInfo)
 * @param {string} type - Notification type: 'started' or 'completed'
 * @returns {Promise<Array>} Array of email sending results
 */
const sendMultipleNotifications = async (userIds, organizationId, data, type = 'completed') => {
  const results = [];

  for (const userId of userIds) {
    try {
      const result = type === 'started' 
        ? await sendUploadStartedNotification(userId, organizationId, data)
        : await sendUploadCompletionNotification(userId, organizationId, data);
      
      results.push({ userId, ...result });
    } catch (error) {
      console.error(`❌ Error sending notification to user ${userId}:`, error);
      results.push({ userId, success: false, error: error.message });
    }
  }

  return results;
};

/**
 * Create job info object for started notifications
 * @param {string} jobId - Job ID
 * @param {number} totalRecords - Total number of policies
 * @param {string} mode - Processing mode ('upsert' or 'individual')
 * @returns {Object} Job info object
 */
const createJobInfo = (jobId, totalRecords, mode = 'individual') => {
  const estimatedTime = mode === 'upsert' ? 
    `${Math.ceil(totalRecords / 1000)} minutes` : 
    `${Math.ceil(totalRecords / 10)} minutes`;

  return {
    jobId,
    totalRecords,
    estimatedProcessingTime: estimatedTime,
    mode
  };
};

/**
 * Create upload result object for completion notifications
 * @param {Object} summary - Upload summary
 * @param {Array} successful - Successful uploads
 * @param {Array} failed - Failed uploads
 * @param {string} mode - Processing mode
 * @param {string} organizationId - Organization ID
 * @param {string} jobId - Job ID
 * @returns {Object} Upload result object
 */
const createUploadResult = (summary, successful, failed, mode, organizationId, jobId) => {
  return {
    message: "Policies bulk upload completed",
    mode,
    summary,
    successful,
    failed: failed.length > 0 ? failed : undefined,
    count: successful.length,
    uploaded: successful,
    organizationId,
    processedAt: new Date(),
    jobId
  };
};

module.exports = {
  sendUploadStartedNotification,
  sendUploadCompletionNotification,
  sendBulkUploadNotification,
  sendMultipleNotifications,
  createJobInfo,
  createUploadResult
}; 