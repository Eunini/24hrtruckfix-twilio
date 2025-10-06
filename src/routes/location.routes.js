const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');

// Receive location data from driver
router.post('/receive-location-data', locationController.receiveLocationData);

module.exports = router; 