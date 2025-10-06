const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/task-controller');
const { authorize } = require('../controllers/validator');

// Apply authorization middleware to all task routes
router.use(authorize);

// Task routes
router.get('/', tasksController.getTasks());

// Task templates
router.get('/templates', async (req, res) => {
  const taskTemplates = require('../assets/task-template.json');
  res.status(200).json({ statusCode: 200, data: taskTemplates });
});

module.exports = router; 