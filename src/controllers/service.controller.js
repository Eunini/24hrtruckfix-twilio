const { HTTP_STATUS_CODES } = require("../helper");
const Service = require("../models/service.model");
const VehicleClassification = require("../models/vehicle-classification.model");
const Ticket = require("../models/ticket.model");
const mongoose = require("mongoose");
const {
  Agent,
  run,
  setDefaultOpenAIKey,
  webSearchTool,
} = require("@openai/agents");

setDefaultOpenAIKey(process.env.OPENAI_API_KEY);

// Create a new service for the current user's organization
exports.createService = async (req, res) => {
  try {
    const {
      name,
      weight_classification = [],
      statesSpecificPrice = [],
      isSystemService = false,
    } = req.body;
    const organizationId =
      isSystemService && ["admin", "super_admin"].includes(req.user.adminRole)
        ? null
        : req.user.organizationId;

    // Validate required fields
    if (!name) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: "Name is required",
      });
    }

    // Validate weight_classification only if provided and not empty
    if (weight_classification && weight_classification.length > 0) {
      const validClassifications = ["light_duty", "medium_duty", "heavy_duty"];
      const classifications =
        weight_classification?.map((item) => item.weight_classification) || [];

      const duplicateClassifications = classifications.filter(
        (classification, index) =>
          classifications.indexOf(classification) !== index
      );
      if (duplicateClassifications.length > 0) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          message: `Duplicate weight classifications found: ${duplicateClassifications.join(
            ", "
          )}`,
        });
      }

      const invalidClassifications = classifications.filter(
        (classification) => !validClassifications.includes(classification)
      );
      if (invalidClassifications.length > 0) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          message: `Invalid weight classifications: ${invalidClassifications.join(
            ", "
          )}. Valid options are: ${validClassifications.join(", ")}`,
        });
      }
    }
    // Check for duplicate states in the input
    if (statesSpecificPrice && statesSpecificPrice.length > 0) {
      const states = statesSpecificPrice.map((item) => item.state);
      const duplicateStates = states.filter(
        (state, index) => states.indexOf(state) !== index
      );
      if (duplicateStates.length > 0) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          message: `Duplicate states found: ${duplicateStates.join(", ")}`,
        });
      }
      // Validate weight_classification in statesSpecificPrice
      const validClassifications = ["light_duty", "medium_duty", "heavy_duty"];
      for (const stateData of statesSpecificPrice) {
        if (
          !Array.isArray(stateData.weight_classification) ||
          stateData.weight_classification.length === 0
        ) {
          return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
            message: `At least one weight_classification is required for state-specific pricing in state '${stateData.state}'`,
          });
        }
        const stateClassifications = stateData.weight_classification.map(
          (item) => item.weight_classification
        );
        const stateDuplicateClassifications = stateClassifications.filter(
          (classification, index) =>
            stateClassifications.indexOf(classification) !== index
        );
        if (stateDuplicateClassifications.length > 0) {
          return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
            message: `Duplicate weight classifications found in state '${
              stateData.state
            }': ${stateDuplicateClassifications.join(", ")}`,
          });
        }
        const stateInvalidClassifications = stateClassifications.filter(
          (classification) => !validClassifications.includes(classification)
        );
        if (stateInvalidClassifications.length > 0) {
          return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
            message: `Invalid weight classifications in state '${
              stateData.state
            }': ${stateInvalidClassifications.join(
              ", "
            )}. Valid options are: ${validClassifications.join(", ")}`,
          });
        }
      }
    }
    const newService = await Service.create({
      name,
      organization: organizationId,
      weight_classification,
      statesSpecificPrice,
      isSystemService,
    });
    await newService.populate("organization", "name");
    res.status(HTTP_STATUS_CODES.CREATED).json({
      message: "Service created successfully",
      data: newService,
    });
  } catch (error) {
    console.error("createService error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// Get all services for the current user's organization
exports.getServices = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        message: "User must belong to an organization to view services",
      });
    }

    // Get both organization services and system services
    const allServices = await Service.find({
      $or: [
        { organization: organizationId }, // User's organization services
        { organization: null }, // System services
      ],
    })
      .populate("organization", "name")
      .sort({ createdAt: -1 });

    // Filter out system services that have the same name as organization services
    const organizationServices = allServices.filter(
      (service) => service.organization !== null
    );
    const systemServices = allServices.filter(
      (service) => service.organization === null
    );

    // Get organization service names (case-insensitive)
    const organizationServiceNames = organizationServices.map((service) =>
      service.name.toLowerCase()
    );

    // Filter system services to exclude those with names that exist in organization services
    const filteredSystemServices = systemServices.filter(
      (systemService) =>
        !organizationServiceNames.includes(systemService.name.toLowerCase())
    );

    // Combine organization services with filtered system services
    const finalServices = [...organizationServices, ...filteredSystemServices];

    res.status(HTTP_STATUS_CODES.OK).json({
      message: "Services retrieved successfully",
      data: finalServices,
    });
  } catch (error) {
    console.error("getServices error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// Get a single service by ID
exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        message: "User must belong to an organization",
      });
    }

    const service = await Service.findOne({
      _id: id,
      organization: organizationId,
    }).populate("organization", "name");

    if (!service) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: "Service not found",
      });
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      message: "Service retrieved successfully",
      data: service,
    });
  } catch (error) {
    console.error("getServiceById error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// Update a service
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const updateData = req.body;

    delete updateData.organization;
    // Validate weight_classification only if provided and not empty
    if (
      updateData.weight_classification &&
      updateData.weight_classification.length > 0
    ) {
      const validClassifications = ["light_duty", "medium_duty", "heavy_duty"];
      const classifications = updateData.weight_classification.map(
        (item) => item.weight_classification
      );
      const duplicateClassifications = classifications.filter(
        (classification, index) =>
          classifications.indexOf(classification) !== index
      );
      if (duplicateClassifications.length > 0) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          message: `Duplicate weight classifications found: ${duplicateClassifications.join(
            ", "
          )}`,
        });
      }
      const invalidClassifications = classifications.filter(
        (classification) => !validClassifications.includes(classification)
      );
      if (invalidClassifications.length > 0) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          message: `Invalid weight classifications: ${invalidClassifications.join(
            ", "
          )}. Valid options are: ${validClassifications.join(", ")}`,
        });
      }
    }
    if (
      updateData.statesSpecificPrice &&
      updateData.statesSpecificPrice.length > 0
    ) {
      const states = updateData.statesSpecificPrice.map((item) => item.state);
      const duplicateStates = states.filter(
        (state, index) => states.indexOf(state) !== index
      );
      if (duplicateStates.length > 0) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          message: `Duplicate states found: ${duplicateStates.join(", ")}`,
        });
      }
      for (const stateData of updateData.statesSpecificPrice) {
        // Validate weight_classification only if provided and not empty
        if (
          stateData.weight_classification &&
          stateData.weight_classification.length > 0
        ) {
          const stateClassifications = stateData.weight_classification.map(
            (item) => item.weight_classification
          );
          const stateDuplicateClassifications = stateClassifications.filter(
            (classification, index) =>
              stateClassifications.indexOf(classification) !== index
          );
          if (stateDuplicateClassifications.length > 0) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
              message: `Duplicate weight classifications found in state '${
                stateData.state
              }': ${stateDuplicateClassifications.join(", ")}`,
            });
          }
          const stateInvalidClassifications = stateClassifications.filter(
            (classification) =>
              !["light_duty", "medium_duty", "heavy_duty"].includes(
                classification
              )
          );
          if (stateInvalidClassifications.length > 0) {
            return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
              message: `Invalid weight classifications in state '${
                stateData.state
              }': ${stateInvalidClassifications.join(
                ", "
              )}. Valid options are: light_duty, medium_duty, heavy_duty`,
            });
          }
        }
      }
    }
    const service = await Service.findOneAndUpdate({ _id: id }, updateData, {
      new: true,
      runValidators: true,
    }).populate("organization", "name");
    if (!service) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: "Service not found",
      });
    }
    res.status(HTTP_STATUS_CODES.OK).json({
      message: "Service updated successfully",
      data: service,
    });
  } catch (error) {
    console.error("updateService error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// Delete a service
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        message: "User must belong to an organization",
      });
    }

    const service = await Service.findOneAndDelete({
      _id: id,
      organization: organizationId,
    });

    if (!service) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: "Service not found",
      });
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      message: "Service deleted successfully",
      data: service,
    });
  } catch (error) {
    console.error("deleteService error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// Add a state to a service (prevent duplicates)
exports.addStateToService = async (req, res) => {
  try {
    const { id } = req.params;
    const { state, weight_classification, isSystemService } = req.body;
    const organizationId =
      isSystemService && ["admin", "super_admin"].includes(req.user.adminRole)
        ? null
        : req.user.organizationId;

    if (!state) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: "State is required",
      });
    }

    // Validate weight_classification only if provided and not empty
    if (weight_classification && weight_classification.length > 0) {
      const validClassifications = ["light_duty", "medium_duty", "heavy_duty"];
      const stateClassifications = weight_classification.map(
        (item) => item.weight_classification
      );
      const stateDuplicateClassifications = stateClassifications.filter(
        (classification, index) =>
          stateClassifications.indexOf(classification) !== index
      );
      if (stateDuplicateClassifications.length > 0) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          message: `Duplicate weight classifications found in state '${state}': ${stateDuplicateClassifications.join(
            ", "
          )}`,
        });
      }
      const stateInvalidClassifications = stateClassifications.filter(
        (classification) => !validClassifications.includes(classification)
      );
      if (stateInvalidClassifications.length > 0) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          message: `Invalid weight classifications in state '${state}': ${stateInvalidClassifications.join(
            ", "
          )}. Valid options are: ${validClassifications.join(", ")}`,
        });
      }
    }
    const service = await Service.findOne({
      _id: id,
      organization: organizationId,
    });
    if (!service) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: "Service not found",
      });
    }
    // Check if state already exists
    const existingState = service.statesSpecificPrice.find(
      (item) => item.state === state
    );
    if (existingState) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: `State '${state}' already exists for this service`,
      });
    }
    // Add the new state
    service.statesSpecificPrice.push({
      state,
      weight_classification: weight_classification || [],
    });
    await service.save();
    await service.populate("organization", "name");
    res.status(HTTP_STATUS_CODES.OK).json({
      message: "State added to service successfully",
      data: service,
    });
  } catch (error) {
    console.error("addStateToService error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// Update a state in a service
exports.updateStateInService = async (req, res) => {
  try {
    const { id, state } = req.params;
    const { weight_classification, isSystemService } = req.body;
    const organizationId =
      isSystemService && ["admin", "super_admin"].includes(req.user.adminRole)
        ? null
        : req.user.organizationId;

    // Validate weight_classification only if provided and not empty
    if (weight_classification && weight_classification.length > 0) {
      const validClassifications = ["light_duty", "medium_duty", "heavy_duty"];
      const stateClassifications = weight_classification.map(
        (item) => item.weight_classification
      );
      const stateDuplicateClassifications = stateClassifications.filter(
        (classification, index) =>
          stateClassifications.indexOf(classification) !== index
      );
      if (stateDuplicateClassifications.length > 0) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          message: `Duplicate weight classifications found in state '${state}': ${stateDuplicateClassifications.join(
            ", "
          )}`,
        });
      }
      const stateInvalidClassifications = stateClassifications.filter(
        (classification) => !validClassifications.includes(classification)
      );
      if (stateInvalidClassifications.length > 0) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          message: `Invalid weight classifications in state '${state}': ${stateInvalidClassifications.join(
            ", "
          )}. Valid options are: ${validClassifications.join(", ")}`,
        });
      }
    }
    const service = await Service.findOne({
      _id: id,
      // organization: organizationId,
      "statesSpecificPrice.state": state,
    });
    if (!service) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: "Service or state not found",
      });
    }
    // Update the specific state's weight_classification
    const stateIndex = service.statesSpecificPrice.findIndex(
      (item) => item.state === state
    );
    if (stateIndex === -1) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: "State not found in service",
      });
    }
    service.statesSpecificPrice[stateIndex].weight_classification =
      weight_classification || [];
    await service.save();
    await service.populate("organization", "name");
    res.status(HTTP_STATUS_CODES.OK).json({
      message: "State updated successfully",
      data: service,
    });
  } catch (error) {
    console.error("updateStateInService error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// Delete a state from a service
exports.deleteStateFromService = async (req, res) => {
  try {
    const { id, state } = req.params;
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        message: "User must belong to an organization",
      });
    }

    const service = await Service.findOne({
      _id: id,
      // organization: organizationId,
    });

    if (!service) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: "Service not found",
      });
    }

    // Find and remove the state
    const initialLength = service.statesSpecificPrice.length;
    service.statesSpecificPrice = service.statesSpecificPrice.filter(
      (item) => item.state !== state
    );

    if (service.statesSpecificPrice.length === initialLength) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: "State not found in service",
      });
    }

    await service.save();
    await service.populate("organization", "name");

    res.status(HTTP_STATUS_CODES.OK).json({
      message: "State deleted from service successfully",
      data: service,
    });
  } catch (error) {
    console.error("deleteStateFromService error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// Calculate service pricing
exports.calculateServicePricing = async (req, res) => {
  try {
    const {
      services,
      amount,
      state,
      vehicleType,
      isTowing = false,
      milesToCover = 0,
    } = req.body;
    const organizationId = req.user.organizationId;

    // Validate required fields
    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: "Services array is required and cannot be empty",
      });
    }

    if (amount === undefined || amount === null) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: "Amount is required",
      });
    }

    if (!state) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: "State is required",
      });
    }

    // Validate towing-related fields
    if (isTowing) {
      if (
        !vehicleType ||
        !["light_duty", "medium_duty", "heavy_duty"].includes(vehicleType)
      ) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          message:
            "Valid vehicle type is required when towing is enabled (light_duty, medium_duty, heavy_duty)",
        });
      }

      if (
        milesToCover === undefined ||
        milesToCover === null ||
        milesToCover < 0
      ) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          message:
            "Miles to cover is required and must be >= 0 when towing is enabled",
        });
      }

      if (!organizationId) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          message: "Organization is required for towing calculations",
        });
      }
    }

    // Build query to get services that either belong to user's organization OR are system services
    const query = {
      _id: { $in: services },
      $or: [
        { organization: organizationId }, // User's organization services
        { organization: null }, // System services (where organization is null)
      ],
    };

    // If user doesn't belong to an organization, only get system services
    if (!organizationId) {
      query.$or = [{ organization: null }];
    }

    const foundServices = await Service.find(query);

    // Check if all requested services were found - fail if any are missing
    if (foundServices.length !== services.length) {
      const foundServiceIds = foundServices.map((service) =>
        service._id.toString()
      );
      const notFoundServices = services.filter(
        (serviceId) => !foundServiceIds.includes(serviceId.toString())
      );

      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: `Services not found or not accessible: ${notFoundServices.join(
          ", "
        )}`,
      });
    }

    let totalPrice = 0;

    // Calculate price for each service
    for (const service of foundServices) {
      let servicePrice = service.basePrice; // Default to base price

      // Check if there's a state-specific price
      if (
        service.statesSpecificPrice &&
        service.statesSpecificPrice.length > 0
      ) {
        const stateSpecificPrice = service.statesSpecificPrice.find(
          (item) => item.state === state
        );

        if (stateSpecificPrice) {
          servicePrice = stateSpecificPrice.weight_classification.reduce(
            (sum, item) => sum + item.price,
            0
          );
        }
      }

      totalPrice += servicePrice;
    }

    let towingCost = 0;
    let towingDetails = null;

    // Calculate towing cost if towing is enabled
    if (isTowing && organizationId) {
      // Get the vehicle classification for the organization and vehicle type
      const vehicleClassification = await VehicleClassification.findOne({
        organizationId: organizationId,
        vehicleType: vehicleType,
      });

      if (!vehicleClassification) {
        return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
          message: `Vehicle classification not found for organization and vehicle type: ${vehicleType}`,
        });
      }

      // Calculate billable miles (first 5 miles are free)
      const freeMiles = 5;
      const billableMiles = Math.max(0, milesToCover - freeMiles);

      // Calculate towing cost
      towingCost = billableMiles * vehicleClassification.ratePerMile;

      towingDetails = {
        vehicleType: vehicleType,
        milesToCover: milesToCover,
        freeMiles: freeMiles,
        billableMiles: billableMiles,
        ratePerMile: vehicleClassification.ratePerMile,
        towingCost: towingCost,
      };
    }

    // Add towing cost to total
    const grandTotal = totalPrice + towingCost;

    // Compare grand total against amount
    const isAcceptable = amount <= grandTotal;

    const response = {
      serviceTotal: totalPrice,
      towingCost: towingCost,
      total: grandTotal,
      amount: amount,
      state: state,
      isAcceptable: isAcceptable,
    };

    // Add towing details if towing was calculated
    if (towingDetails) {
      response.towingDetails = towingDetails;
    }

    res.status(HTTP_STATUS_CODES.OK).json(response);
  } catch (error) {
    console.error("calculateServicePricing error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

exports.aICalculateServicePricing = async (req, res) => {
  try {
    const { userPrompt, ticketId, previousResponseId } = req.body;
    const organizationId = req.user.organizationId;

    // Validate required fields
    if (!userPrompt || !ticketId) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: "userPrompt and ticketId are required",
      });
    }

    if (!organizationId) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: "Organization is required for AI pricing calculations",
      });
    }

    // Get ticket information
    const ticket = await Ticket.findById(ticketId).populate(
      "organization_id",
      "name"
    );

    if (!ticket) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: "Ticket not found",
      });
    }

    // Ensure ticket belongs to user's organization
    if (ticket.organization_id._id.toString() !== organizationId.toString()) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        message: "Access denied: Ticket does not belong to your organization",
      });
    }

    // Get organization services
    const organizationServices = await Service.find({
      $or: [
        { organization: organizationId }, // Organization-specific services
        { organization: null }, // System services
      ],
    });

    // Get vehicle classifications for towing calculations
    const vehicleClassifications = await VehicleClassification.find({
      organizationId: organizationId,
    });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE).json({
        message: "AI service is currently unavailable",
      });
    }

    // Prepare context for AI
    const ticketContext = {
      ticketId: ticket._id,
      organizationName: ticket.organization_id.name,
      vehicleInfo: {
        make: ticket.vehicle_make,
        model: ticket.vehicle_model,
        color: ticket.vehicle_color,
        year: ticket.vehicle_year,
        type: ticket.vehicle_type,
        licensePlate: ticket.license_plate_no,
      },
      location: {
        currentAddress: ticket.current_address,
        breakdownAddress: ticket.breakdown_address,
        towDestination: ticket.tow_destination,
        state: ticket.breakdown_address?.state,
      },
      breakdownInfo: {
        reasons: ticket.breakdown_reason,
        description: ticket.breakdown_reason_text,
      },
      customerInfo: {
        name: ticket.insured_name,
        phone: ticket.current_cell_number,
      },
      status: ticket.status,
    };

    const availableServices = organizationServices.map((service) => ({
      id: service._id,
      name: service.name,
      basePrice: service.basePrice,
      stateSpecificPrices: service.statesSpecificPrice,
      isSystemService: !service.organization,
    }));

    const towingRates = vehicleClassifications.map((vc) => ({
      vehicleType: vc.vehicleType,
      price: vc.price,
      ratePerMile: vc.ratePerMile,
      ratePerReturnMile: vc.ratePerReturnMile,
    }));

    // Create AI system prompt with calculation rules
    const systemPrompt = `You are an expert service pricing calculator for ${
      ticket.organization_id.name
    }. 

CALCULATION RULES:
1. Service Pricing:
   - Use basePrice as default for each service
   - If stateSpecificPrices exist and match the ticket's state, use that price instead
   - Sum all selected service prices

2. Towing Calculations (when applicable):
   - First 5 miles are FREE
   - Only charge for miles beyond 5 miles
   - Use ratePerMile from vehicle classifications based on vehicle type
   - Formula: (totalMiles - 5) × ratePerMile (if totalMiles > 5, otherwise $0)

3. Total Cost:
   - ServiceTotal + TowingCost = Grand Total

4. Service Selection Guidelines:
   - Recommend services based on breakdown reasons and description
   - Consider vehicle type and location
   - Factor in weather, time of day, and urgency

AVAILABLE SERVICES:
${JSON.stringify(availableServices, null, 2)}

TOWING RATES:
${JSON.stringify(towingRates, null, 2)}

TICKET CONTEXT:
${JSON.stringify(ticketContext, null, 2)}

Provide a comprehensive pricing analysis including:
- Recommended services with individual prices
- Towing calculations (if needed)
- Total cost breakdown
- Reasoning for service selection
- Any important considerations or notes

Format your response as a detailed but easy-to-understand explanation for the customer service team.`;

    const userMessage = `Customer request: "${userPrompt}"

Please analyze this request and provide detailed service pricing calculations based on the ticket information and available services.`;

    const agent = new Agent({
      name: "Service Pricing Agent",
      instructions: systemPrompt,
      model: "gpt-4o-mini",
      tools: [webSearchTool()],
    });

    const aiResponse = await run(agent, userMessage, {
      previousResponseId: previousResponseId || null,
    });

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      ticketId: ticketId,
      userPrompt: userPrompt,
      aiResponse: aiResponse.finalOutput,
      previousResponseId: aiResponse.lastResponseId,
    });
  } catch (error) {
    console.error("aICalculateServicePricing error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// Add a weight classification to a service
exports.addWeightClassificationToService = async (req, res) => {
  try {
    const { id } = req.params;
    const { weight_classification, price } = req.body;
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        message: "User must belong to an organization",
      });
    }

    if (!weight_classification || price === undefined) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: "Weight classification and price are required",
      });
    }

    // Validate weight classification
    const validClassifications = ["light_duty", "medium_duty", "heavy_duty"];
    if (!validClassifications.includes(weight_classification)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: `Invalid weight classification. Valid options are: ${validClassifications.join(
          ", "
        )}`,
      });
    }

    const service = await Service.findOne({
      _id: id,
    });

    if (!service) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: "Service not found",
      });
    }

    // Check if weight classification already exists
    const existingClassification = service.weight_classification.find(
      (item) => item.weight_classification === weight_classification
    );

    if (existingClassification) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: `Weight classification '${weight_classification}' already exists for this service`,
      });
    }

    // Add the new weight classification
    service.weight_classification.push({ weight_classification, price });
    await service.save();

    await service.populate("organization", "name");

    res.status(HTTP_STATUS_CODES.OK).json({
      message: "Weight classification added to service successfully",
      data: service,
    });
  } catch (error) {
    console.error("addWeightClassificationToService error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// Update a weight classification in a service
exports.updateWeightClassificationInService = async (req, res) => {
  try {
    const { id, classification } = req.params;
    const { price } = req.body;
    const organizationId = req.user.organizationId;

    // if (!organizationId) {
    //   return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
    //     message: "User must belong to an organization",
    //   });
    // }

    if (price === undefined) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: "Price is required",
      });
    }

    const service = await Service.findOne({
      _id: id,
      // organization: organizationId,
      "weight_classification.weight_classification": classification,
    });

    if (!service) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: "Service or weight classification not found",
      });
    }

    // Update the specific weight classification's price
    const classificationIndex = service.weight_classification.findIndex(
      (item) => item.weight_classification === classification
    );

    if (classificationIndex === -1) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: "Weight classification not found in service",
      });
    }

    service.weight_classification[classificationIndex].price = price;
    await service.save();

    await service.populate("organization", "name");

    res.status(HTTP_STATUS_CODES.OK).json({
      message: "Weight classification updated successfully",
      data: service,
    });
  } catch (error) {
    console.error("updateWeightClassificationInService error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// Delete a weight classification from a service
exports.deleteWeightClassificationFromService = async (req, res) => {
  try {
    const { id, classification } = req.params;
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        message: "User must belong to an organization",
      });
    }

    const service = await Service.findOne({
      _id: id,
      // organization: organizationId,
    });

    if (!service) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: "Service not found",
      });
    }

    // Remove the weight classification
    const initialLength = service.weight_classification.length;
    service.weight_classification = service.weight_classification.filter(
      (item) => item.weight_classification !== classification
    );

    if (service.weight_classification.length === initialLength) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: "Weight classification not found in service",
      });
    }

    await service.save();
    await service.populate("organization", "name");

    res.status(HTTP_STATUS_CODES.OK).json({
      message: "Weight classification deleted successfully",
      data: service,
    });
  } catch (error) {
    console.error("deleteWeightClassificationFromService error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};
