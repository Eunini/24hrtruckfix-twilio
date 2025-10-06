const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const serviceProviderController = require('../controllers/service-provider.controller');

// Get all service providers
router.get('/service-providers', authenticate, serviceProviderController.getAllServiceProviders);

// Get a single service provider by ID
router.get('/service-providers/:id', authenticate, serviceProviderController.getServiceProviderById);

// Create a new service provider
router.post('/service-providers', authenticate, serviceProviderController.createServiceProvider);

// Update a service provider
router.put('/service-providers/:id', authenticate, serviceProviderController.updateServiceProvider);

// Delete a service provider
router.delete('/service-providers/:id', authenticate, serviceProviderController.deleteServiceProvider);

module.exports = router; 