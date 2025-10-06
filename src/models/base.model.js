const mongoose = require('mongoose');

class BaseModel {
  static getModel(modelName, schema) {
    try {
      // Try to get the existing model
      return mongoose.model(modelName);
    } catch (error) {
      // If model doesn't exist, create it
      return mongoose.model(modelName, schema);
    }
  }

  static createModel(modelName, schema) {
    if (!modelName || !schema) {
      throw new Error('Model name and schema are required');
    }
    return this.getModel(modelName, schema);
  }
}

module.exports = BaseModel; 