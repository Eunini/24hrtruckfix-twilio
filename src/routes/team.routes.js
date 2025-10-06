const express = require('express');
const router = express.Router();
const teamsController = require('../controllers/teams-controller');
const { authorize } = require('../controllers/validator');

// Apply authorization middleware to all team routes
router.use(authorize);

// Team routes
router.get('/', teamsController.getAllTeams());
router.post('/sync', teamsController.syncAllTeams());

module.exports = router; 