const moment = require("moment");
const mongoose = require("mongoose");
const Policy = require("../models/policy.model");
const User = require("../models/user.model");
const Role = require("../models/role.model");
const Organization = require("../models/organization.model");
const { vapiSendTwilloMessage } = require("../services/conversation.service");
const { reverseGeocodeCoordinates } = require("../services/location.service");

// Get all policies with pagination
exports.getPolicies = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "", sort = "-createdAt" } = req.query;

    const userId = req.user.userId;
    const activeOrgId = req.user.organizationId; // <-- derived from JWT/session

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (!activeOrgId || !mongoose.Types.ObjectId.isValid(activeOrgId)) {
      return res
        .status(400)
        .json({ message: "No active organization context found" });
    }

    // Build base query
    const query = {};

    // Search terms
    if (typeof search === "string" && search.trim()) {
      const terms = search
        .trim()
        .split(/\s+/)
        .filter((t) => t);
      if (terms.length) {
        query.$and = terms.map((term) => {
          const regex = new RegExp(term, "i");
          return {
            $or: [
              { policy_number: { $regex: regex } },
              { insured_first_name: { $regex: regex } },
              { insured_last_name: { $regex: regex } },
              { vehicle_manufacturer: { $regex: regex } },
              { vehicle_vin: { $regex: regex } },
              { vehicle_model_year: { $regex: regex } },
              { licensePlate: { $regex: regex } },
              { vehicle_color: { $regex: regex } },
              { vehicle_model: { $regex: regex } },
              { policy_effective_date: { $regex: regex } },
              { policy_expiration_date: { $regex: regex } },
              { agency_name: { $regex: regex } },
              { address: { $regex: regex } },
            ],
          };
        });
      }
    }

    // Fetch user & role
    const user = await User.findById(userId).populate("role_id");
    if (!user || !user.role_id) {
      return res.status(404).json({ message: "User or role not found" });
    }
    const userRole = user.role_id.name;
    const exemptRoles = ["admin", "super_admin", "sub_admin", "ai"];

    // Helper: check membership/ownership of activeOrgId
    const isMemberOrOwner = await Organization.findOne({
      _id: new mongoose.Types.ObjectId(activeOrgId),
      $or: [
        { owner: new mongoose.Types.ObjectId(userId) },
        { "members.user": new mongoose.Types.ObjectId(userId) },
      ],
    }).lean();

    if (!exemptRoles.includes(userRole)) {
      if (!isMemberOrOwner) {
        return res
          .status(403)
          .json({ message: "You do not have access to this organization" });
      }
    }
    // Now filter by this single org:
    query.organization_id = new mongoose.Types.ObjectId(activeOrgId);

    // Parse sort
    const sortOption = {};
    if (typeof sort === "string" && sort.trim()) {
      const field = sort.startsWith("-") ? sort.substring(1) : sort;
      const dir = sort.startsWith("-") ? -1 : 1;
      sortOption[field] = dir;
    }

    // Pagination
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);

    const options = {
      page: pageNum,
      limit: limitNum,
      sort: sortOption,
      populate: [
        {
          path: "organization_id",
          select: "companyName keyBillingContactEmail keyBillingContactPhone",
        },
      ],
    };

    console.log("getPolicies: filtering by activeOrgId:", activeOrgId);
    console.log("getPolicies: final query:", query);

    const policiesPage = await Policy.paginate(query, options);
    return res.json(policiesPage);
  } catch (error) {
    console.error("Error in getPolicies:", error);
    return res.status(500).json({ message: error.message });
  }
};

exports.getCombinedPolicies = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "", sort = "-createdAt" } = req.query;

    const userId = req.user.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ message: "User ID is required or invalid" });
    }

    const pageNum = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
    const limitNum = parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 10;

    const query = {};

    // Handle search
    if (typeof search === "string" && search.trim()) {
      const searchTerms = search
        .split(" ")
        .filter((term) => term.trim().length > 0);
      if (searchTerms.length > 0) {
        query.$and = searchTerms.map((term) => {
          const regex = { $regex: term, $options: "i" };
          return {
            $or: [
              { policy_number: regex },
              { insured_first_name: regex },
              { insured_last_name: regex },
              { vehicle_manufacturer: regex },
              { vehicle_vin: regex },
              { vehicle_model_year: regex },
              { licensePlate: regex },
              { vehicle_color: regex },
              { vehicle_model: regex },
              { policy_effective_date: regex },
              { policy_expiration_date: regex },
              { agency_name: regex },
              { address: regex },
            ],
          };
        });
      }
    }

    // Fetch user + role
    const user = await User.findById(userId).populate("role_id");
    if (!user || !user.role_id) {
      return res.status(404).json({ message: "User or role not found" });
    }

    const userRole = user.role_id.name;
    const exemptRoles = ["admin", "super_admin", "sub_admin", "ai"];

    if (!exemptRoles.includes(userRole)) {
      if (userRole === "agent" || userRole === "client") {
        const userOrgs = await Organization.find({
          $or: [{ owner: userId }, { "members.user": userId }],
        }).select("_id");

        if (!userOrgs || userOrgs.length === 0) {
          return res.json({
            docs: [],
            totalDocs: 0,
            limit: limitNum,
            page: pageNum,
            totalPages: 0,
            pagingCounter: 0,
            hasPrevPage: false,
            hasNextPage: false,
            prevPage: null,
            nextPage: null,
          });
        }

        // Add multiple orgs to query
        query.organization_id = { $in: userOrgs.map((org) => org._id) };
      } else {
        return res.json({
          docs: [],
          totalDocs: 0,
          limit: limitNum,
          page: pageNum,
          totalPages: 0,
          pagingCounter: 0,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        });
      }
    }

    // Sort logic
    let sortOption = {};
    if (typeof sort === "string" && sort.trim()) {
      const field = sort.startsWith("-") ? sort.substring(1) : sort;
      const dir = sort.startsWith("-") ? -1 : 1;
      sortOption[field] = dir;
    }

    const options = {
      page: pageNum,
      limit: limitNum,
      sort: sortOption,
      populate: [
        {
          path: "organization_id",
          select: "name email phone",
        },
      ],
    };

    const policies = await Policy.paginate(query, options);

    return res.json(policies);
  } catch (error) {
    console.error("Error in getCombinedPolicies:", error);
    return res.status(500).json({ message: error.message });
  }
};

// Search policy by name and number
exports.searchPolicyByNameAndNumber = async (req, res) => {
  try {
    const ps = new URLSearchParams(req.params.searchTerm);
    const search = ps.get("search") || "";
    const orgId = ps.get("orgId") || null;

    if (!search || typeof search !== "string") {
      return res.status(400).json({ message: "Search term is required" });
    }

    // if orgId is provided, use it; otherwise fall back to the user's org
    let organizationId = req.user.organizationId;
    if (orgId && mongoose.Types.ObjectId.isValid(orgId)) {
      organizationId = new mongoose.Types.ObjectId(orgId);
    } else {
      console.log("⚠️ skipping invalid orgId:", orgId);
    }
    const searchs = search.split(" ").filter(Boolean);
    const stringSearchFields = [
      "policy_number",
      "insured_last_name",
      "insured_first_name",
      "insured_middle_initial",
    ];

    let query = { $or: [], organization_id: organizationId };

    if (searchs.length > 1) {
      query.$or.push({
        $and: [
          {
            insured_first_name: {
              $regex: new RegExp(`^${searchs[0]}`, "i"),
            },
          },
          {
            insured_last_name: {
              $regex: new RegExp(`^${searchs[1]}`, "i"),
            },
          },
          {
            insured_middle_initial: {
              $regex: new RegExp(`^${searchs[1]}`, "i"),
            },
          },
          { vehicle_model: { $regex: new RegExp(`^${searchs[1]}`, "i") } },
        ],
      });
    }

    query.$or.push(
      ...stringSearchFields.map((field) => ({
        [field]: { $regex: new RegExp(`^${search}`, "i") },
      }))
    );

    const policies = await Policy.find(
      query,
      "policy_number insured_first_name insured_last_name insured_middle_initial address policy_expiration_date vehicle_manufacturer vehicle_model vehicle_model_year vehicle_vin policy_effective_date risk_address_line_1 risk_address_city risk_address_state risk_address_zip_code vehicles"
    ).limit(10);
    console.log(policies, query, search, searchs);
    res.json(policies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new policy
exports.createNewPolicy = async (req, res) => {
  try {
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;
    const policy = req.body;

    if (!organizationId) {
      return res
        .status(401)
        .json({ message: "User must belong to an organization" });
    }

    // Construct address
    const address = [
      policy?.risk_address_line_1,
      policy?.risk_address_city,
      policy?.risk_address_state,
      policy?.risk_address_zip_code,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    // Check for existing policy
    const vehicleQuery = {
      $or: [
        {
          vehicle_manufacturer:
            policy.vehicles?.[0]?.vehicle_manufacturer || null,
          vehicle_vin: policy.vehicles?.[0]?.vehicle_vin || null,
          vehicle_model_year: policy.vehicles?.[0]?.vehicle_model_year || null,
          licensePlate: policy.vehicles?.[0]?.licensePlate || null,
          vehicle_color: policy.vehicles?.[0]?.vehicle_color || null,
          vehicle_model: policy.vehicles?.[0]?.vehicle_model || null,
        },
        {
          vehicles: {
            $elemMatch: {
              vehicle_model_year:
                policy.vehicles?.[0]?.vehicle_model_year || null,
              vehicle_manufacturer:
                policy.vehicles?.[0]?.vehicle_manufacturer || null,
              vehicle_model: policy.vehicles?.[0]?.vehicle_model || null,
              vehicle_vin: policy.vehicles?.[0]?.vehicle_vin || null,
              vehicle_color: policy.vehicles?.[0]?.vehicle_color || null,
              licensePlate: policy.vehicles?.[0]?.licensePlate || null,
            },
          },
        },
      ],
    };

    const existingPolicy = await Policy.findOne({
      policy_number: policy.policy_number,
      insured_first_name: policy.insured_first_name,
      insured_last_name: policy.insured_last_name,
      policy_effective_date: policy.policy_effective_date,
      policy_expiration_date: policy.policy_expiration_date,
      organization_id: organizationId,
      ...vehicleQuery,
    });

    if (existingPolicy) {
      return res.status(400).json({ message: "Policy already exists" });
    }

    // Create new policy
    const newPolicy = await Policy.create({
      ...policy,
      address,
      organization_id: organizationId,
      policy_creation_api_type: policy.policy_creation_api_type || "admin-api",
      version: policy.version || 1,
      added_by: userId,
    });

    res.status(201).json(newPolicy);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update policy
exports.updatePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const policy = req.body;

    if (policy?.policy_creation_api_type) {
      delete policy.policy_creation_api_type;
    }
    delete policy?._id;

    const address = [
      policy?.risk_address_line_1,
      policy?.risk_address_city,
      policy?.risk_address_state,
      policy?.risk_address_zip_code,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const updatedPolicy = await Policy.findByIdAndUpdate(
      id,
      { ...policy, address },
      { new: true }
    );

    if (!updatedPolicy) {
      return res.status(404).json({ message: "Policy not found" });
    }

    res.json(updatedPolicy);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get admin policies
exports.getAdminPolicies = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortField = "createdAt",
      sort = -1,
      client_id = "",
    } = req.query;

    const query = {};

    if (search.trim()) {
      const searchTerms = search
        .split(" ")
        .filter((term) => term.trim().length > 0);
      query.$and = searchTerms.map((term) => ({
        $or: [
          { policy_number: { $regex: term, $options: "i" } },
          { insured_first_name: { $regex: term, $options: "i" } },
          { insured_last_name: { $regex: term, $options: "i" } },
          { vehicle_manufacturer: { $regex: term, $options: "i" } },
          { vehicle_vin: { $regex: term, $options: "i" } },
          { vehicle_model_year: { $regex: term, $options: "i" } },
          { licensePlate: { $regex: term, $options: "i" } },
          { vehicle_color: { $regex: term, $options: "i" } },
          { vehicle_model: { $regex: term, $options: "i" } },
          { policy_effective_date: { $regex: term, $options: "i" } },
          { policy_expiration_date: { $regex: term, $options: "i" } },
          { agency_name: { $regex: term, $options: "i" } },
          { "vehicles.vehicle_manufacturer": { $regex: term, $options: "i" } },
          { "vehicles.vehicle_vin": { $regex: term, $options: "i" } },
          { "vehicles.vehicle_model_year": { $regex: term, $options: "i" } },
          { "vehicles.vehicle_model": { $regex: term, $options: "i" } },
          { "vehicles.vehicle_color": { $regex: term, $options: "i" } },
          { "vehicles.licensePlate": { $regex: term, $options: "i" } },
          { address: { $regex: term, $options: "i" } },
        ],
      }));
    }

    if (client_id) {
      query.client_id = client_id;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortField]: parseInt(sort) },
    };

    const policies = await Policy.paginate(query, options);
    res.json(policies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get policy by ID
exports.getPolicyById = async (req, res) => {
  try {
    const { id } = req.params;
    const policy = await Policy.findById(id);

    if (!policy) {
      return res.status(404).json({ message: "Policy not found" });
    }

    res.json(policy);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Validate policy
exports.validatePolicy = async (req, res) => {
  try {
    const { policy_number } = req.body;

    if (!policy_number) {
      return res.status(400).json({ message: "The policy number is required" });
    }

    const existingPolicy = await Policy.findOne({ policy_number });

    if (!existingPolicy) {
      return res.json({
        exists: false,
        expired: null,
        message: "Policy does not exist",
      });
    }

    const currentDate = moment();
    const expirationDate = moment(
      existingPolicy.policy_expiration_date,
      "MM/DD/YYYY",
      true
    );

    if (expirationDate.isBefore(currentDate)) {
      return res.json({
        exists: true,
        expired: true,
        message: "The policy exists but expired",
      });
    }

    res.json({
      exists: true,
      expired: false,
      message: "The policy exists and still valid",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get policy by number
exports.getPolicyByNumber = async (req, res) => {
  try {
    const { policy_number } = req.params;
    const organizationId = req.user.organizationId;

    if (!policy_number) {
      return res.status(400).json({ message: "The policy number is required" });
    }

    if (!organizationId) {
      return res
        .status(401)
        .json({ message: "User must belong to an organization" });
    }

    const policy = await Policy.aggregate([
      {
        $match: {
          policy_number: { $regex: `^${policy_number}$`, $options: "i" },
          organization_id: organizationId,
        },
      },
    ])
      .sort({ createdAt: -1 })
      .limit(1);

    if (!policy.length) {
      return res.status(404).json({ message: "Policy does not exist" });
    }

    res.json({
      data: policy[0],
      message: "The policy exists",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get policy by client ID
exports.getPolicyByClientId = async (req, res) => {
  try {
    const { client_id, policy_number } = req.query;
    const organizationId = req.user.organizationId;

    if (!client_id) {
      return res.status(400).json({ message: "Client ID is required" });
    }

    if (!organizationId) {
      return res
        .status(401)
        .json({ message: "User must belong to an organization" });
    }

    const query = {
      client_id: new mongoose.Types.ObjectId(client_id),
      organization_id: organizationId,
    };

    if (policy_number) {
      query.policy_number = policy_number;
    }

    const policies = await Policy.find(query);
    res.json(policies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get recent policies
exports.getRecentPolicies = async (req, res) => {
  try {
    const { client_id, page = 1, limit = 10 } = req.query;

    if (!client_id) {
      return res.status(400).json({ message: "Client ID is required" });
    }

    const query = {
      client_id: new mongoose.Types.ObjectId(client_id),
    };

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      select:
        "policy_number insured_first_name insured_last_name policy_expiration_date address vehicles createdAt client_id",
      populate: {
        path: "client_id",
        select: "firstname lastname phoneNumber",
      },
    };

    const policies = await Policy.paginate(query, options);
    res.json(policies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete policy
exports.deletePolicy = async (req, res) => {
  try {
    let { id } = req.params;
    if (!id) return res.status(400).json({ message: "No identifier provided" });

    id = decodeURIComponent(id).trim();
    const normalizePhone = (s = "") => s.replace(/[\s\-\(\)\+]/g, "");
    if (mongoose.Types.ObjectId.isValid(id)) {
      try {
        const result = await Policy.deleteOne({
          _id: new mongoose.Types.ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Policy not found" });
        }
        return res.json({ message: "Policy deleted successfully" });
      } catch (err) {
        console.warn("delete by _id failed:", err?.message);
      }
    }

    const normalized = normalizePhone(id);
    const result = await Policy.deleteOne({
      $or: [
        { policy_number: id },
        { policy_number: normalized },
        { phone: id },
        { phone: normalized },
      ],
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message:
          "Policy not found with given identifier. Provide a valid ObjectId or a matching policyNumber/phone.",
      });
    }

    return res.json({ message: "Policy deleted successfully" });
  } catch (error) {
    console.error("deletePolicy error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// VAPI Validate Policy - handles VAPI function calls
exports.vapiValidatePolicy = async (req, res) => {
  try {
    console.log("🔍 VAPI Policy Validation Request:");
    const toolCalls = req.body.message.toolCalls;

    const toolCall = toolCalls[0];
    const tool_id = toolCall.id;
    const functionCall = toolCall.function;
    const parameters = functionCall.arguments;
    const policy_number = parameters.policy_number;

    // Check if this is a VAPI function call
    if (policy_number) {
      console.log("📋 Validating policy number:", policy_number);

      if (!policy_number) {
        return res.status(200).json({
          results: [
            {
              toolCallId: tool_id,
              result: JSON.stringify({
                exists: false,
                expired: null,
                message: "Policy number is required",
              }),
            },
          ],
        });
      }

      // Find the policy
      const existingPolicy = await Policy.findOne({
        policy_number: { $regex: `^${policy_number}$`, $options: "i" },
      });

      if (!existingPolicy) {
        return res.status(200).json({
          results: [
            {
              toolCallId: tool_id,
              result: JSON.stringify({
                exists: false,
                expired: null,
                message: "Policy does not exist",
              }),
            },
          ],
        });
      }

      // Check if policy is expired
      const currentDate = moment();
      const expirationDate = moment(
        existingPolicy.policy_expiration_date,
        "MM/DD/YYYY",
        true
      );

      if (expirationDate.isBefore(currentDate)) {
        return res.status(200).json({
          results: [
            {
              toolCallId: tool_id,
              result: JSON.stringify({
                exists: true,
                expired: true,
                message: "The policy exists but is expired",
              }),
            },
          ],
        });
      }

      // Policy is valid
      return res.status(200).json({
        results: [
          {
            toolCallId: tool_id,
            result: JSON.stringify({
              exists: true,
              expired: false,
              policyData: existingPolicy,
              message:
                "The policy exists and is still valid. Use this when validing the veehicle color, make and other details.",
            }),
          },
        ],
      });
    } else {
      // Handle direct API calls (non-VAPI) - fallback to original logic
      const { policy_number } = req.body;

      if (!policy_number) {
        return res
          .status(400)
          .json({ message: "The policy number is required" });
      }

      const existingPolicy = await Policy.findOne({ policy_number });

      if (!existingPolicy) {
        return res.json({
          exists: false,
          expired: null,
          message: "Policy does not exist",
        });
      }

      const currentDate = moment();
      const expirationDate = moment(
        existingPolicy.policy_expiration_date,
        "MM/DD/YYYY",
        true
      );

      if (expirationDate.isBefore(currentDate)) {
        return res.json({
          exists: true,
          expired: true,
          message: "The policy exists but expired",
        });
      }

      res.json({
        exists: true,
        expired: false,
        message: "The policy exists and still valid",
      });
    }
  } catch (error) {
    console.error("❌ VAPI Policy Validation Error:", error);

    // Return VAPI-compatible error response
    return res.status(200).json({
      results: [
        {
          toolCallId: tool_id || "unknown",
          result: JSON.stringify({
            exists: false,
            expired: null,
            message: "An error occurred while validating the policy",
          }),
        },
      ],
    });
  }
};

// Note: Bulk upload policies is now handled by the background queue system
// See /api/v1/bulk-upload/policies endpoint

// VAPI Send SMS - handles VAPI function calls
exports.vapiSendSms = async (req, res) => {
  let tool_id = null;
  try {
    console.log("🔍 VAPI Send SMS Request:");
    const toolCalls = req.body.message?.toolCalls;
    const phone_number = req.body.message?.customer?.number;
    const callId = req.body.message?.call?.id;

    if (!toolCalls || !toolCalls.length) {
      return res.status(400).json({
        message: "Invalid request: No tool calls found",
      });
    }

    const toolCall = toolCalls[0];
    tool_id = toolCall.id;
    const functionCall = toolCall.function;

    // Parse parameters, handling potential JSON string
    let parameters;
    try {
      parameters =
        typeof functionCall.arguments === "string"
          ? JSON.parse(functionCall.arguments)
          : functionCall.arguments;
    } catch (e) {
      console.error("Failed to parse parameters:", e);
      parameters = {};
    }

    if (!phone_number) {
      return res.status(200).json({
        results: [
          {
            toolCallId: tool_id,
            result: JSON.stringify({
              sent: false,
              message: "Phone number is required",
            }),
          },
        ],
      });
    }

    // Log the SMS sending attempt
    console.log("📋 Sending SMS to phone number:", phone_number);
    console.log("🔍 VAPI Send SMS Request Call ID:", callId);

    // TODO: Implement actual SMS sending logic here

    const sendMessageResponse = await vapiSendTwilloMessage({
      to: phone_number,
      body: `The link to the form is ${process.env.FRONTEND_URL}/collect-location?callId=${callId}`,
    });

    // For now, return success placeholder
    return res.status(200).json({
      results: [
        {
          toolCallId: tool_id,
          result: JSON.stringify({
            sent: true,
            message: `SMS sent successfully to ${phone_number}`,
            twilioMessageId: sendMessageResponse?.sid,
            twilioMessageStatus: sendMessageResponse?.status,
          }),
        },
      ],
    });
  } catch (error) {
    console.error("Error in vapiSendSms:", error);
    return res.status(500).json({
      results: [
        {
          toolCallId: tool_id || "unknown",
          result: JSON.stringify({
            sent: false,
            message: "Internal server error while sending SMS",
          }),
        },
      ],
    });
  }
};

// VAPI Get Reverse Geocode - handles VAPI function calls
exports.vapiGetReverseGeocode = async (req, res) => {
  let tool_id = null;
  try {
    console.log("🔍 VAPI Get Reverse Geocode Request:");
    const toolCalls = req.body.message?.toolCalls;
    const callId = req.body.message?.call?.id;
    console.log("🔍 VAPI Get Reverse Geocode Request Tool Calls:", req.body);

    if (!toolCalls || !toolCalls.length) {
      return res.status(400).json({
        message: "Invalid request: No tool calls found",
      });
    }

    const toolCall = toolCalls[0];
    tool_id = toolCall.id;
    const functionCall = toolCall.function;

    // Parse parameters, handling potential JSON string
    let parameters;
    try {
      parameters =
        typeof functionCall.arguments === "string"
          ? JSON.parse(functionCall.arguments)
          : functionCall.arguments;
    } catch (e) {
      console.error("Failed to parse parameters:", e);
      parameters = {};
    }

    if (!parameters?.latitude || !parameters?.longitude) {
      return res.status(200).json({
        results: [
          {
            toolCallId: tool_id,
            result: JSON.stringify({
              success: false,
              message: "Latitude and longitude are required",
            }),
          },
        ],
      });
    }
    console.log("🔍 VAPI Get Reverse Geocode Request Parameters:", parameters);

    const geoCodeResponse = await reverseGeocodeCoordinates(
      parameters?.latitude,
      parameters?.longitude,
      process.env.GOOGLE_MAPS_API_KEY,
      true
    );

    if (!geoCodeResponse) {
      return res.status(200).json({
        results: [
          {
            toolCallId: tool_id,
            result: JSON.stringify({
              success: false,
              message: "Failed to get reverse geocode",
            }),
          },
        ],
      });
    }

    // For now, return success placeholder
    return res.status(200).json({
      results: [
        {
          toolCallId: tool_id,
          result: JSON.stringify({
            success: true,
            message: `Geocode request sent successfully`,
            geoCodeResponse,
          }),
        },
      ],
    });
  } catch (error) {
    console.error("Error in vapiGetReverseGeocode:", error);
    return res.status(500).json({
      results: [
        {
          toolCallId: tool_id || "unknown",
          result: JSON.stringify({
            success: false,
            message: "Internal server error while sending geocode request",
          }),
        },
      ],
    });
  }
};
