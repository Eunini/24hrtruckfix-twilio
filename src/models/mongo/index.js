const ModelMap = require("./map")
class ModelManager {

  constructor() {
    this.models = {}
    this.initiated = false
    this.mongoose = null
  }

  bind(mongoose) {
    this.mongoose = mongoose
    return this
  }

  init(mongoose) {
    if(this.initiated)
      return this

    // Fallback in case mongoose is not called
    this.mongoose = mongoose
    
    let self = this
    Object.keys(ModelMap).map(function(model) {
      self.models[model] = require(`./schemas/${ModelMap[model]}`)(self.mongoose)
    })

    this.initiated = true
    return this
  }
  
  register(model, force = false) {
    console.log(model);
    if(!ModelMap[model]) {
      throw new Error(`Invalid Model - ${model}`)
    }
    console.log(model,"finished");
    if(this.models[model] && !force) {
      console.log("Model already registered")
      return this
    }

    this.models[model] = require(`./schemas/${ModelMap[model]}`)(this.mongoose)
    return this
  }

  get(model) {
    if(!this.models[model]) {
      throw new Error(`Unregistered Model - ${model}`)
    }
    return this.models[model]
  }

  isInitiated() {
    return this.initiated
  }
  
}

module.exports = new ModelManager