const ServiceProvider = require('../models/service-provider.model');

// Get all service providers
exports.getAllServiceProviders = async (req, res) => {
  try {
    const serviceProviders = await ServiceProvider.find();
    res.json(serviceProviders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single service provider by ID
exports.getServiceProviderById = async (req, res) => {
  try {
    const serviceProvider = await ServiceProvider.findById(req.params.id);
    if (!serviceProvider) {
      return res.status(404).json({ message: 'Service provider not found' });
    }
    res.json(serviceProvider);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new service provider
exports.createServiceProvider = async (req, res) => {
  try {
    const serviceProvider = new ServiceProvider(req.body);
    const newServiceProvider = await serviceProvider.save();
    res.status(201).json(newServiceProvider);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update a service provider
exports.updateServiceProvider = async (req, res) => {
  try {
    const serviceProvider = await ServiceProvider.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!serviceProvider) {
      return res.status(404).json({ message: 'Service provider not found' });
    }
    res.json(serviceProvider);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete a service provider
exports.deleteServiceProvider = async (req, res) => {
  try {
    const serviceProvider = await ServiceProvider.findByIdAndDelete(req.params.id);
    if (!serviceProvider) {
      return res.status(404).json({ message: 'Service provider not found' });
    }
    res.json({ message: 'Service provider deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 