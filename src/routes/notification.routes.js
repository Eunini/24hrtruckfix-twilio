const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const notificationController = require('../controllers/notification.controller');

// Policy upload notification routes
router.post('/notifications/policy-upload/started', authenticate, notificationController.sendUploadStartedNotification);
router.post('/notifications/policy-upload/completed', authenticate, notificationController.sendUploadCompletionNotification);
router.post('/notifications/policy-upload/bulk', authenticate, notificationController.sendBulkUploadNotification);
router.post('/notifications/policy-upload/multiple', authenticate, notificationController.sendMultipleNotifications);

// Test email configuration
router.get('/notifications/test', authenticate, notificationController.testEmailConfiguration);

module.exports = router; 