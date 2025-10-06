#!/usr/bin/env node

import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mongoose types for schema analysis
const { Schema, Types } = mongoose;
const ObjectId = Types.ObjectId;
const Mixed = Schema.Types.Mixed;

// Schema analysis helper - Parse Mongoose schemas from codebase
function analyzeMongooseSchema(schema) {
  const schemaInfo = {};

  function analyzeSchemaObject(schemaObj, path = "") {
    if (!schemaObj || typeof schemaObj !== "object") return;

    // Handle different schema types
    if (schemaObj.type) {
      const fieldPath = path || "root";
      schemaInfo[fieldPath] = {
        type: getMongooseType(schemaObj.type),
        required: schemaObj.required || false,
        default: schemaObj.default,
        unique: schemaObj.unique || false,
        enum: schemaObj.enum,
        ref: schemaObj.ref,
        sparse: schemaObj.sparse || false,
        immutable: schemaObj.immutable || false,
        trim: schemaObj.trim || false,
        lowercase: schemaObj.lowercase || false,
        uppercase: schemaObj.uppercase || false,
        min: schemaObj.min,
        max: schemaObj.max,
        minlength: schemaObj.minlength,
        maxlength: schemaObj.maxlength,
        match: schemaObj.match,
        validate: schemaObj.validate,
        get: schemaObj.get,
        set: schemaObj.set,
        select: schemaObj.select,
        index: schemaObj.index,
        _id: schemaObj._id,
      };
    }

    // Handle nested objects
    if (schemaObj.constructor && schemaObj.constructor.name === "Schema") {
      // This is a nested schema
      const fields = schemaObj.obj || schemaObj.paths || {};
      Object.keys(fields).forEach((fieldName) => {
        const fieldPath = path ? `${path}.${fieldName}` : fieldName;
        analyzeSchemaObject(fields[fieldName], fieldPath);
      });
    }

    // Handle arrays
    if (Array.isArray(schemaObj)) {
      const fieldPath = path || "root";
      schemaInfo[fieldPath] = {
        type: "array",
        items: schemaObj[0] ? analyzeMongooseSchema(schemaObj[0]) : "mixed",
      };
    }

    // Handle plain objects with nested fields
    if (
      schemaObj &&
      typeof schemaObj === "object" &&
      !schemaObj.type &&
      !Array.isArray(schemaObj)
    ) {
      Object.keys(schemaObj).forEach((key) => {
        const fieldPath = path ? `${path}.${key}` : key;
        analyzeSchemaObject(schemaObj[key], fieldPath);
      });
    }
  }

  analyzeSchemaObject(schema);
  return schemaInfo;
}

function getMongooseType(type) {
  if (!type) return "mixed";

  // Handle string types
  if (type === String) return "String";
  if (type === Number) return "Number";
  if (type === Boolean) return "Boolean";
  if (type === Date) return "Date";
  if (type === Buffer) return "Buffer";
  if (type === ObjectId) return "ObjectId";
  if (type === Mixed) return "Mixed";
  if (type === Array) return "Array";

  // Handle string representations
  if (typeof type === "string") {
    switch (type.toLowerCase()) {
      case "string":
        return "String";
      case "number":
        return "Number";
      case "boolean":
        return "Boolean";
      case "date":
        return "Date";
      case "buffer":
        return "Buffer";
      case "objectid":
        return "ObjectId";
      case "mixed":
        return "Mixed";
      case "array":
        return "Array";
      default:
        return type;
    }
  }

  // Handle Schema.Types
  if (type && type.constructor && type.constructor.name) {
    return type.constructor.name;
  }

  return "mixed";
}

// Import and analyze models from codebase
async function getModelsFromCodebase() {
  try {
    // Use dynamic import to load models
    const modelsPath = path.join(__dirname, "../src/models/index.js");
    const modelsPathUrl = `file://${modelsPath.replace(/\\/g, "/")}`;
    const models = await import(modelsPathUrl);

    const modelSchemas = {};

    // Extract schemas from each model
    for (const [modelName, model] of Object.entries(models)) {
      if (model && model.schema) {
        try {
          modelSchemas[modelName] = analyzeMongooseSchema(model.schema);
        } catch (schemaError) {
          console.warn(
            `Error analyzing schema for ${modelName}:`,
            schemaError.message
          );
          // Continue with other models
        }
      }
    }

    return modelSchemas;
  } catch (error) {
    console.error("Error loading models from codebase:", error);
    return {};
  }
}

// Test the functionality
async function testSchemaAnalysis() {
  console.log("🧪 Testing schema analysis...");

  try {
    const modelSchemas = await getModelsFromCodebase();
    const modelNames = Object.keys(modelSchemas);

    console.log(`✅ Found ${modelNames.length} models:`);
    modelNames.forEach((name) => {
      console.log(`   • ${name}`);
    });

    // Test a specific model
    if (modelNames.length > 0) {
      const testModel = modelNames[0];
      console.log(`\n📋 Schema for ${testModel}:`);
      console.log(JSON.stringify(modelSchemas[testModel], null, 2));
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testSchemaAnalysis();
