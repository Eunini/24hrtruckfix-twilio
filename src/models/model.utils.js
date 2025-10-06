const BaseModel = require('./base.model');

const getOrCreateModel = (modelName, schema) => {
  return BaseModel.createModel(modelName, schema);
};

module.exports = {
  getOrCreateModel
}; 