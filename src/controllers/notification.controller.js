const notificationService = require('../services/policyUploadNotification.service');
const { HTTP_STATUS_CODES } = require('../helper');

/**
 * Send policy upload started notification
 * @route POST /api/notifications/policy-upload/started
 */
exports.sendUploadStartedNotification = async (req, res) => {
  try {
    const { userId, organizationId, jobInfo } = req.body;

    if (!userId || !organizationId || !jobInfo) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'userId, organizationId, and jobInfo are required'
      });
    }

    const result = await notificationService.sendUploadStartedNotification(
      userId,
      organizationId,
      jobInfo
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      success: result.success,
      message: result.success ? 'Upload started notification sent successfully' : 'Failed to send notification',
      error: result.error || undefined
    });

  } catch (error) {
    console.error('sendUploadStartedNotification error:', error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Send policy upload completion notification
 * @route POST /api/notifications/policy-upload/completed
 */
exports.sendUploadCompletionNotification = async (req, res) => {
  try {
    const { userId, organizationId, uploadResult } = req.body;

    if (!userId || !organizationId || !uploadResult) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'userId, organizationId, and uploadResult are required'
      });
    }

    const result = await notificationService.sendUploadCompletionNotification(
      userId,
      organizationId,
      uploadResult
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      success: result.success,
      message: result.success ? 'Upload completion notification sent successfully' : 'Failed to send notification',
      error: result.error || undefined
    });

  } catch (error) {
    console.error('sendUploadCompletionNotification error:', error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Send bulk upload notification (for background workers)
 * @route POST /api/notifications/policy-upload/bulk
 */
exports.sendBulkUploadNotification = async (req, res) => {
  try {
    const { jobData, type = 'completed' } = req.body;

    if (!jobData) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'jobData is required'
      });
    }

    if (!['started', 'completed'].includes(type)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'type must be either "started" or "completed"'
      });
    }

    const result = await notificationService.sendBulkUploadNotification(jobData, type);

    res.status(HTTP_STATUS_CODES.OK).json({
      success: result.success,
      message: result.success ? `Bulk upload ${type} notification sent successfully` : 'Failed to send notification',
      error: result.error || undefined
    });

  } catch (error) {
    console.error('sendBulkUploadNotification error:', error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Send notifications to multiple recipients
 * @route POST /api/notifications/policy-upload/multiple
 */
exports.sendMultipleNotifications = async (req, res) => {
  try {
    const { userIds, organizationId, data, type = 'completed' } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0 || !organizationId || !data) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'userIds (array), organizationId, and data are required'
      });
    }

    if (!['started', 'completed'].includes(type)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'type must be either "started" or "completed"'
      });
    }

    const results = await notificationService.sendMultipleNotifications(
      userIds,
      organizationId,
      data,
      type
    );

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    res.status(HTTP_STATUS_CODES.OK).json({
      success: successCount > 0,
      message: `Sent ${successCount} notifications successfully, ${failureCount} failed`,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount
      }
    });

  } catch (error) {
    console.error('sendMultipleNotifications error:', error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Test email configuration
 * @route GET /api/notifications/test
 */
exports.testEmailConfiguration = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'email query parameter is required'
      });
    }

    // Send a test completion notification
    const testResult = {
      message: "Test email notification",
      mode: "test",
      summary: {
        total: 10,
        successful: 8,
        failed: 2,
        successRate: "80.00%",
        processingTime: "1 minute"
      },
      successful: [
        { policy_number: 'TEST-001', id: 'test_id_1', success: true },
        { policy_number: 'TEST-002', id: 'test_id_2', success: true }
      ],
      failed: [
        { policy_number: 'TEST-003', error: 'Test error message', success: false }
      ],
      organizationId: 'test_org_id',
      processedAt: new Date(),
      jobId: 'test_job_123'
    };

    const { sendPolicyUploadCompletionEmail } = require('../services/mail/policyUploadCompletionMail');
    
    const result = await sendPolicyUploadCompletionEmail(
      email,
      testResult,
      { companyName: 'Test Organization' },
      { firstname: 'Test', lastname: 'User', email }
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      success: result.success,
      message: result.success ? 'Test email sent successfully' : 'Failed to send test email',
      error: result.error || undefined,
      recipient: email
    });

  } catch (error) {
    console.error('testEmailConfiguration error:', error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
}; 