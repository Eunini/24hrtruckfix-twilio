const { HTTP_STATUS_CODES } = require("../helper");
const { Policy, Driver } = require("../models");

// Helper function to create or get policy for driver
const createOrGetDriverPolicy = async (driver) => {
  try {
    // Use driver's phone number as policy number
    const policyNumber = driver.phone;

    // Check if policy already exists
    let policy = await Policy.findOne({
      policy_number: policyNumber,
      organization_id: driver.organization,
    });

    if (!policy) {
      // Create new policy for the driver
      const newPolicyData = {
        policy_number: policyNumber,
        organization_id: driver.organization,
        policy_effective_date: new Date().toISOString().split("T")[0], // Today's date
        policy_expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0], // 1 year from now
        insured_first_name: driver.firstName,
        insured_last_name: driver.lastName,
        risk_address_line_1:
          driver.emergencyContact?.address || "Address not provided",
        risk_address_city: "City not provided",
        risk_address_state: "State not provided",
        risk_address_zip_code: "00000",
        agency_name: "Driver Self-Service Portal",
        vehicles: [],
        version: 1,
        policy_creation_api_type: "driver-portal",
        added_by: driver._id.toString(),
      };

      policy = await Policy.create(newPolicyData);
      console.log(
        `Created new policy ${policyNumber} for driver ${driver._id}`
      );
    }

    return policy;
  } catch (error) {
    console.error("Error creating/getting driver policy:", error);
    throw error;
  }
};

// Add vehicle to driver's policy (using driver's phone as policy number)
exports.addVehicleToPolicy = async (req, res) => {
  try {
    const vehicleData = req.body;
    const driverId = req.driver.driverId;
    const organizationId = req.driver.organizationId;

    // Validate required fields
    if (
      !vehicleData.vehicle_vin ||
      !vehicleData.vehicle_manufacturer ||
      !vehicleData.vehicle_model
    ) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Vehicle VIN, manufacturer, and model are required",
      });
    }

    // Get driver information
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Create or get policy for driver
    const policy = await createOrGetDriverPolicy(driver);

    // Check if vehicle with same VIN already exists in this policy
    const existingVehicle = policy.vehicles.find(
      (vehicle) => vehicle.vehicle_vin === vehicleData.vehicle_vin
    );

    if (existingVehicle) {
      return res.status(HTTP_STATUS_CODES.CONFLICT).json({
        success: false,
        message: "Vehicle with this VIN already exists in your policy",
      });
    }

    // Prepare vehicle object
    const newVehicle = {
      vehicle_model_year: vehicleData.vehicle_model_year,
      vehicle_manufacturer: vehicleData.vehicle_manufacturer,
      vehicle_model: vehicleData.vehicle_model,
      vehicle_vin: vehicleData.vehicle_vin,
      vehicle_color: vehicleData.vehicle_color,
      licensePlate: vehicleData.licensePlate,
      warranties: vehicleData.warranties || [],
      drivers: [
        {
          client_id: driverId,
          first_name: driver.firstName,
          last_name: driver.lastName,
          license_number:
            driver.licenseNumber || vehicleData.driver_license_number,
          license_state: vehicleData.driver_license_state,
          license_expiration_date: vehicleData.driver_license_expiration_date,
          date_of_birth: vehicleData.driver_date_of_birth,
        },
      ],
    };

    // Process warranties if provided
    if (vehicleData.warranties && Array.isArray(vehicleData.warranties)) {
      newVehicle.warranties = vehicleData.warranties.map((warranty) => ({
        warrantyNumber: warranty.warrantyNumber,
        coverageType: warranty.coverageType || "full-vehicle",
        startDate: warranty.startDate
          ? new Date(warranty.startDate)
          : new Date(),
        endDate: warranty.endDate ? new Date(warranty.endDate) : null,
        deductible: warranty.deductible || 0,
        isActive: warranty.isActive !== undefined ? warranty.isActive : true,
        isTransferable: warranty.isTransferable || false,
        terms: warranty.terms || "",
        coveredParts: warranty.coveredParts || [],
        authorizedServiceProviders: warranty.authorizedServiceProviders || [],
      }));
    }

    // Add vehicle to policy
    policy.vehicles.push(newVehicle);
    await policy.save();

    return res.status(HTTP_STATUS_CODES.CREATED).json({
      success: true,
      message: "Vehicle added to your policy successfully",
      data: {
        policy_number: policy.policy_number,
        vehicle: newVehicle,
      },
    });
  } catch (error) {
    console.error("Add vehicle to policy error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get driver's policy (using driver's phone as policy number)
exports.getDriverPolicy = async (req, res) => {
  try {
    const driverId = req.driver.driverId;
    const organizationId = req.driver.organizationId;

    // Get driver information
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Use driver's phone number as policy number
    const policyNumber = driver.phone;

    // Find the policy by driver's phone number and organization
    let policy = await Policy.findOne({
      policy_number: policyNumber,
      organization_id: organizationId,
    }).populate("organization_id", "companyName");

    if (!policy) {
      // Check if driver has payment methods set up
      const hasPaymentMethod =
        driver.stripe_customer_id &&
        ((driver.plan === "payperuse" && driver.payPerUseStatus === "paid") ||
          (driver.plan === "monthly" &&
            driver.subscriptionStatus === "active"));

      if (hasPaymentMethod) {
        // Driver has payment method but no policy - create one automatically
        try {
          policy = await createOrGetDriverPolicy(driver);
          await policy.populate("organization_id", "companyName");

          console.log(
            `Auto-created policy for driver ${driver._id} with phone ${driver.phone}`
          );

          return res.status(HTTP_STATUS_CODES.OK).json({
            success: true,
            data: {
              policy,
            },
            message: "Policy created automatically based on your payment setup",
          });
        } catch (policyError) {
          console.error("Error auto-creating policy:", policyError);
          return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Failed to create policy automatically",
            error:
              process.env.NODE_ENV === "development"
                ? policyError.message
                : undefined,
          });
        }
      } else {
        // No payment method found
        return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
          success: false,
          message:
            "No policy found. Add a payment method to create your policy.",
        });
      }
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: {
        policy,
      },
    });
  } catch (error) {
    console.error("Get driver policy error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update vehicle in driver's policy
exports.updateVehicleInPolicy = async (req, res) => {
  try {
    const { vehicle_vin } = req.params;
    const updateData = req.body;
    const driverId = req.driver.driverId;
    const organizationId = req.driver.organizationId;

    // Get driver information
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Use driver's phone number as policy number
    const policyNumber = driver.phone;

    // Find the policy
    const policy = await Policy.findOne({
      policy_number: policyNumber,
      organization_id: organizationId,
    });

    if (!policy) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message:
          "Policy not found. Add a payment method to create your policy.",
      });
    }

    // Find the vehicle in the policy
    const vehicleIndex = policy.vehicles.findIndex(
      (vehicle) => vehicle.vehicle_vin === vehicle_vin
    );

    if (vehicleIndex === -1) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Vehicle not found in your policy",
      });
    }

    // Update vehicle data
    const vehicle = policy.vehicles[vehicleIndex];

    if (updateData.vehicle_color)
      vehicle.vehicle_color = updateData.vehicle_color;
    if (updateData.licensePlate) vehicle.licensePlate = updateData.licensePlate;
    if (updateData.vehicle_model_year)
      vehicle.vehicle_model_year = updateData.vehicle_model_year;

    // Update warranties if provided
    if (updateData.warranties && Array.isArray(updateData.warranties)) {
      vehicle.warranties = updateData.warranties.map((warranty) => ({
        warrantyNumber: warranty.warrantyNumber,
        coverageType: warranty.coverageType || "full-vehicle",
        startDate: warranty.startDate
          ? new Date(warranty.startDate)
          : new Date(),
        endDate: warranty.endDate ? new Date(warranty.endDate) : null,
        deductible: warranty.deductible || 0,
        isActive: warranty.isActive !== undefined ? warranty.isActive : true,
        isTransferable: warranty.isTransferable || false,
        terms: warranty.terms || "",
        coveredParts: warranty.coveredParts || [],
        authorizedServiceProviders: warranty.authorizedServiceProviders || [],
      }));
    }

    await policy.save();

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "Vehicle updated successfully",
      data: {
        policy_number: policy.policy_number,
        vehicle: policy.vehicles[vehicleIndex],
      },
    });
  } catch (error) {
    console.error("Update vehicle error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Remove vehicle from driver's policy
exports.removeVehicleFromPolicy = async (req, res) => {
  try {
    const { vehicle_vin } = req.params;
    const driverId = req.driver.driverId;
    const organizationId = req.driver.organizationId;

    // Get driver information
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Use driver's phone number as policy number
    const policyNumber = driver.phone;

    // Find the policy
    const policy = await Policy.findOne({
      policy_number: policyNumber,
      organization_id: organizationId,
    });

    if (!policy) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message:
          "Policy not found. Add a payment method to create your policy.",
      });
    }

    // Find and remove the vehicle
    const vehicleIndex = policy.vehicles.findIndex(
      (vehicle) => vehicle.vehicle_vin === vehicle_vin
    );

    if (vehicleIndex === -1) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Vehicle not found in your policy",
      });
    }

    // Remove vehicle from array
    const removedVehicle = policy.vehicles.splice(vehicleIndex, 1)[0];
    await policy.save();

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "Vehicle removed from your policy successfully",
      data: {
        policy_number: policy.policy_number,
        removedVehicle,
      },
    });
  } catch (error) {
    console.error("Remove vehicle error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Add warranty to vehicle in driver's policy
exports.addWarrantyToVehicle = async (req, res) => {
  try {
    const { vehicle_vin } = req.params;
    const warrantyData = req.body;
    const driverId = req.driver.driverId;
    const organizationId = req.driver.organizationId;

    // Validate warranty data
    if (!warrantyData.warrantyNumber) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Warranty number is required",
      });
    }

    // Get driver information
    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Use driver's phone number as policy number
    const policyNumber = driver.phone;

    // Find the policy
    const policy = await Policy.findOne({
      policy_number: policyNumber,
      organization_id: organizationId,
    });

    if (!policy) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message:
          "Policy not found. Add a payment method to create your policy.",
      });
    }

    // Find the vehicle
    const vehicle = policy.vehicles.find(
      (vehicle) => vehicle.vehicle_vin === vehicle_vin
    );

    if (!vehicle) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Vehicle not found in your policy",
      });
    }

    // Check if warranty already exists
    const existingWarranty = vehicle.warranties.find(
      (warranty) => warranty.warrantyNumber === warrantyData.warrantyNumber
    );

    if (existingWarranty) {
      return res.status(HTTP_STATUS_CODES.CONFLICT).json({
        success: false,
        message: "Warranty with this number already exists for this vehicle",
      });
    }

    // Create warranty object
    const newWarranty = {
      warrantyNumber: warrantyData.warrantyNumber,
      coverageType: warrantyData.coverageType || "full-vehicle",
      startDate: warrantyData.startDate
        ? new Date(warrantyData.startDate)
        : new Date(),
      endDate: warrantyData.endDate ? new Date(warrantyData.endDate) : null,
      deductible: warrantyData.deductible || 0,
      isActive:
        warrantyData.isActive !== undefined ? warrantyData.isActive : true,
      isTransferable: warrantyData.isTransferable || false,
      terms: warrantyData.terms || "",
      coveredParts: warrantyData.coveredParts || [],
      authorizedServiceProviders: warrantyData.authorizedServiceProviders || [],
    };

    // Add warranty to vehicle
    vehicle.warranties.push(newWarranty);
    await policy.save();

    return res.status(HTTP_STATUS_CODES.CREATED).json({
      success: true,
      message: "Warranty added to vehicle successfully",
      data: {
        policy_number: policy.policy_number,
        vehicle_vin: vehicle.vehicle_vin,
        warranty: newWarranty,
      },
    });
  } catch (error) {
    console.error("Add warranty error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Export the helper function for use in other controllers
exports.createOrGetDriverPolicy = createOrGetDriverPolicy;
