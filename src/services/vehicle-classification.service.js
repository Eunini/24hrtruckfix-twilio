const VehicleClassification = require("../models/vehicle-classification.model");
const { Organization } = require("../models");

// Upsert vehicle classification (create or update) - can be system default or organization specific
exports.upsertVehicleClassification = async (
  returnMileageThreshold = 0,
  ratePerMile = 0,
  statesSpecific = [],
  organizationId = null
) => {
  // Validate organization exists if provided
  if (organizationId) {
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }
  }

  // Validate required fields
  if (returnMileageThreshold < 0) {
    throw new Error("Return mileage threshold must be >= 0");
  }

  if (ratePerMile < 0) {
    throw new Error("Rate per mile must be >= 0");
  }

  // Validate statesSpecific data
  if (statesSpecific && statesSpecific.length > 0) {
    const states = statesSpecific.map((item) => item.state);
    const duplicateStates = states.filter(
      (state, index) => states.indexOf(state) !== index
    );

    if (duplicateStates.length > 0) {
      throw new Error(`Duplicate states found: ${duplicateStates.join(", ")}`);
    }

    // Validate mileage fields in statesSpecific
    for (const stateData of statesSpecific) {
      if (stateData.returnMileageThreshold < 0) {
        throw new Error(
          `Return mileage threshold for state '${stateData.state}' must be >= 0`
        );
      }

      if (stateData.ratePerMile < 0) {
        throw new Error(
          `Rate per mile for state '${stateData.state}' must be >= 0`
        );
      }
    }
  }

  // Use findOneAndUpdate  with upsert to create or update
  const vehicleClassification = await VehicleClassification.findOneAndUpdate(
    organizationId ? { organizationId } : { organizationId: null },
    {
      returnMileageThreshold,
      ratePerMile,
      organizationId,
      statesSpecific,
      isSystemDefault: organizationId === null,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    }
  ).populate("organizationId", "companyName");

  return vehicleClassification;
};

// Get vehicle classification for an organization (falls back to system default if not found)
exports.getVehicleClassificationByOrganization = async (organizationId) => {
  // First try to get organization-specific classification
  let vehicleClassification = await VehicleClassification.findOne({
    organizationId,
  }).populate("organizationId", "companyName");

  // If not found, get system default
  if (!vehicleClassification) {
    vehicleClassification = await VehicleClassification.findOne({
      isSystemDefault: true,
    }).populate("organizationId", "companyName");
  }

  return vehicleClassification;
};

// Get system default vehicle classification
exports.getSystemDefaultVehicleClassification = async () => {
  const vehicleClassification = await VehicleClassification.findOne({
    isSystemDefault: true,
  }).populate("organizationId", "companyName");

  return vehicleClassification;
};

// Get all vehicle classifications
exports.getAllVehicleClassifications = async () => {
  const vehicleClassifications = await VehicleClassification.find({})
    .populate("organizationId", "companyName")
    .sort({ isSystemDefault: -1, organizationId: 1 });

  return vehicleClassifications;
};

// Delete vehicle classification
exports.deleteVehicleClassification = async (organizationId = null) => {
  const vehicleClassification = await VehicleClassification.findOneAndDelete({
    organizationId,
  });

  if (!vehicleClassification) {
    throw new Error("Vehicle classification not found");
  }

  return vehicleClassification;
};

// Add state to vehicle classification
exports.addStateToVehicleClassification = async (
  state,
  returnMileageThreshold = 0,
  ratePerMile = 0,
  organizationId = null
) => {
  const vehicleClassification = await VehicleClassification.findOne({
    organizationId,
  });

  if (!vehicleClassification) {
    throw new Error("Vehicle classification not found");
  }

  // Check if state already exists
  const existingState = vehicleClassification.statesSpecific.find(
    (item) => item.state === state
  );

  if (existingState) {
    throw new Error(
      `State '${state}' already exists for this vehicle classification`
    );
  }

  // Validate mileage fields
  if (returnMileageThreshold < 0) {
    throw new Error("Return mileage threshold must be >= 0");
  }

  if (ratePerMile < 0) {
    throw new Error("Rate per mile must be >= 0");
  }

  // Add the new state
  vehicleClassification.statesSpecific.push({
    state,
    returnMileageThreshold,
    ratePerMile,
  });
  await vehicleClassification.save();

  return vehicleClassification.populate("organizationId", "companyName");
};

// Update state in vehicle classification
exports.updateStateInVehicleClassification = async (
  state,
  returnMileageThreshold,
  ratePerMile,
  organizationId = null
) => {
  const vehicleClassification = await VehicleClassification.findOne({
    organizationId,
    "statesSpecific.state": state,
  });

  if (!vehicleClassification) {
    throw new Error("Vehicle classification or state not found");
  }

  // Validate mileage fields
  if (returnMileageThreshold < 0) {
    throw new Error("Return mileage threshold must be >= 0");
  }

  if (ratePerMile < 0) {
    throw new Error("Rate per mile must be >= 0");
  }

  // Update the specific state
  const stateIndex = vehicleClassification.statesSpecific.findIndex(
    (item) => item.state === state
  );

  if (stateIndex === -1) {
    throw new Error("State not found in vehicle classification");
  }

  vehicleClassification.statesSpecific[stateIndex].returnMileageThreshold =
    returnMileageThreshold;
  vehicleClassification.statesSpecific[stateIndex].ratePerMile = ratePerMile;
  await vehicleClassification.save();

  return vehicleClassification.populate("organizationId", "companyName");
};

// Delete state from vehicle classification
exports.deleteStateFromVehicleClassification = async (
  state,
  organizationId = null
) => {
  const vehicleClassification = await VehicleClassification.findOne({
    organizationId,
  });

  if (!vehicleClassification) {
    throw new Error("Vehicle classification not found");
  }

  // Remove the state
  const initialLength = vehicleClassification.statesSpecific.length;
  vehicleClassification.statesSpecific =
    vehicleClassification.statesSpecific.filter((item) => item.state !== state);

  if (vehicleClassification.statesSpecific.length === initialLength) {
    throw new Error("State not found in vehicle classification");
  }

  await vehicleClassification.save();
  return vehicleClassification.populate("organizationId", "companyName");
};
