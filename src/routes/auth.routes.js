const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// Authentication routes
router.post('/loginUser', authController.loginUser);
router.post('/registerUser', authController.registerUser);
router.post('/verify-2fa', authController.verify2FAToken);
router.post('/verify-2FAuth', authController.verify2FACode);
router.post('/send-2FAuth', authController.send2FACode);
router.post('/forgot-password', authController.customForgotPassword);
router.post('/reset/password', authController.customResetPassword);
router.post('/check-otp', authController.customOTP);

// User profile routes
router.get('/profile', authenticate, authController.getMyProfile);
router.put('/profile', authenticate, authController.profileUpdate);
router.get('/user-org', authenticate, authController.userOrg);
router.patch('/settings', authController.updateUserSettings);
router.post('/profile/image', authenticate, authController.profileUploadImage);
router.get('/profile/:id/image', authenticate, authController.getProfileImage);

// User management routes
router.get('/users', authController.getUsersList);
router.get('/users/:id', authController.getUserById);
router.put('/users/:id', authController.userUpdate);
router.delete('/users/:id', authController.userDelete);

// 2FA management
router.post('/users/:id/2fa', authController.verify2FAToken);

// AI switch routes
router.post('/ai/switch', authController.switchAI);
router.post('/ai/switch/global', authController.globalswitchAI);

// Onboarding routes
router.post('/onboarding', authController.onboarding);
router.post('/onboarding/verify', authController.verifyOnboard);
router.get('/onboarding', authController.listOnboarding);

// Admin routes
router.get('/admin', authController.getAdminDetails);
router.post('/admin/TempUser', authController.TempUser);

// Key contacts routes
router.post('/key-contacts', authController.createKeyContact);
router.get('/key-contacts', authController.getKeyContacts);

module.exports = router; 