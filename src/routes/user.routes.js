const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');

// Apply authorization middleware
router.use(authorize);

// User management routesr
router.get('/users/list', userController.getUsersList);
router.get('/users/client/list', userController.getClientList);
router.get('/users/:id', userController.getUserById);
router.put('/users/update', userController.userUpdate);
router.put('/users/profile/update', userController.profileUpdate);
router.post('/users/profile/upload-image', userController.profileUploadImage);
router.delete('/users/delete', userController.userDelete);
// 
// 
// AI switch routesrouter.post('/users/switch-ai', userController.switchAI);router.post('/users/global-switch-ai', userController.globalswitchAI);// Admin routesrouter.get('/users/admin/details', userController.getAdminDetails);// Onboarding routesrouter.post('/users/onboarding', userController.onboarding);

module.exports = router; 