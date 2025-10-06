const express = require('express');
const router = express.Router();
const { authorize } = require('../controllers/validator');

// Import AI Activity handlers
const aiHandlers = require('../../AIActivity/functions');

// Apply authorization middleware
router.use(authorize);

// AI Activity routes
router.post('/analyze', aiHandlers.analyzeActivity);
router.get('/recommendations', aiHandlers.getRecommendations);
router.get('/insights', aiHandlers.getInsights);
router.post('/feedback', aiHandlers.provideFeedback);

// AI Settings
router.get('/settings', aiHandlers.getAISettings);
router.put('/settings', aiHandlers.updateAISettings);

module.exports = router; 