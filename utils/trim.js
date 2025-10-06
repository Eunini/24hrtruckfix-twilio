const mongoose = require('mongoose');

function trimPlugin(schema) {
  function trimDocumentStrings(next) {
    if (this instanceof mongoose.Query) {
      const update = this.getUpdate();
      if (update) {
        trimObjectStrings(update);
        if (update.$set) {
          trimObjectStrings(update.$set);
        }
      }
    } else {
      const doc = this;
      schema.eachPath((path, schematype) => {
        const instance = schematype.instance;
        if (instance === 'String') {
          const val = doc.get(path);
          if (typeof val === 'string') {
            doc.set(path, val.trim());
          }
        } else if (instance === 'Array' && schematype.caster && schematype.caster.instance === 'String') {
          const arr = doc.get(path);
          if (Array.isArray(arr)) {
            const trimmed = arr.map(item => typeof item === 'string' ? item.trim() : item);
            doc.set(path, trimmed);
          }
        }
      });
    }
    next();
  }

  function trimObjectStrings(obj) {
    if (typeof obj !== 'object' || obj === null) return;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string') {
        obj[key] = val.trim();
      } else if (Array.isArray(val)) {
        obj[key] = val.map(item => typeof item === 'string' ? item.trim() : item);
      } else if (val && typeof val === 'object' && val.constructor === Object) {
        trimObjectStrings(val);
      }
    }
  }

  schema.pre('save', trimDocumentStrings);
  schema.pre('findOneAndUpdate', trimDocumentStrings);
  schema.pre('updateOne', trimDocumentStrings);
  schema.pre('updateMany', trimDocumentStrings);
}

module.exports = trimPlugin;
