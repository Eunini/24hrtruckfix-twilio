const RoleModel = require("../../../models/role.model");
const UserModel = require("../../../models/user.model");
const PoliciesModel = require("../../../models/policy.model");
const OrganizationModel = require("../../../models/organization.model");
const moment = require("moment");
const mongoose = require("mongoose");
const { fetchUser } = require("./users");

// Import email notification services
const {
  sendPolicyUploadCompletionEmail,
  sendPolicyUploadStartedEmail,
} = require("../../../services/mail/policyUploadCompletionMail");

exports.savePolicies = async (policies) => {
  console.log("policies to be inserted in DB", policies?.length);
  let insertedPolicy = null;
  try {
    insertedPolicy = await PoliciesModel.insertMany(policies);
    return insertedPolicy;
  } catch (ex) {
    console.error("exception savePolicyData", ex);
  }
  return insertedPolicy;
};

exports.getPolicies = async (offset = 0, limit = 10, userId) => {
  console.log("getPolicies", { offset, limit, userId });

  if (!userId) {
    throw new Error("User ID is required");
  }

  const query = {};
  const options = {
    offset,
    limit,
    sort: { createdAt: -1 },
  };

  // Fetch user and their role
  const user = await fetchUser(userId);

  // console.log({user})

  if (!user || !user.role_id) {
    throw new Error("User or role not found");
  }

  const userRole = user.role_id.name;
  // Assuming role_id has a 'name' field
  const exemptRoles = ["admin", "super_admin", "sub_admin", "ai"];

  if (exemptRoles.includes(userRole)) {
    // For exempt roles, fetch all policies (or policies for user's org if required)
    /*
    const userOrg = await OrganizationModel.findOne({
      $or: [
        { owner: userId },
      ],
    });
    if (userOrg) {
      query.organization_id = userOrg._id;
    }
    */
  } else if (userRole === "client") {
    // For client role, fetch policies for their organization
    const userOrg = await OrganizationModel.findOne({
      $or: [{ owner: userId }],
    });
    if (!userOrg) {
      return { docs: [], totalDocs: 0, offset, limit }; // Return empty paginated result
    }
    query.organization_id = userOrg._id;
  } else {
    // For other roles, return empty result (or handle as needed)
    return { docs: [], totalDocs: 0, offset, limit };
  }

  try {
    // Ensure MongoDB connection (if not globally managed)
    // // Uncomment if needed

    const policies = await PoliciesModel.paginate(query, options);
    return policies;
  } catch (ex) {
    console.error("Exception in getPolicies:", ex);
    throw new Error("Failed to fetch policies");
  }
};

exports.searchPolicyByNameAndNumber = async (searchTerm) => {
  console.log("searchPolicyByNameAndNumber searchTerm:", searchTerm);
  let policies = null;
  try {
    console.log("searchTerm", searchTerm);
    const searchTerms = searchTerm.split(" ").filter(Boolean);

    const stringSearchFields = [
      "policy_number",
      "insured_last_name",
      "insured_first_name",
      "insured_middle_initial",
    ];

    // Base query - client_id handling is currently commented out
    // let baseQuery = {};
    // if (client_id) {
    //     baseQuery.client_id = client_id;
    // }

    let query = {
      // ...baseQuery, // client_id is not being used at the moment
      $or: [],
    };

    if (searchTerms.length > 1) {
      query.$or.push({
        $and: [
          {
            insured_first_name: {
              $regex: new RegExp(`^${searchTerms[0]}`, "i"),
            },
          },
          {
            insured_last_name: {
              $regex: new RegExp(`^${searchTerms[1]}`, "i"),
            },
          },
          {
            insured_middle_initial: {
              $regex: new RegExp(`^${searchTerms[1]}`, "i"),
            },
          },
          {
            vehicle_model: {
              $regex: new RegExp(`^${searchTerms[1]}`, "i"),
            },
          },
        ],
      });
    }

    query.$or.push(
      ...stringSearchFields.map((field) => ({
        [field]: { $regex: new RegExp(`^${searchTerm}`, "i") },
      }))
    );

    const queryForLog = JSON.parse(
      JSON.stringify(query, (key, value) =>
        value instanceof RegExp ? value.toString() : value
      )
    );

    console.log("Final MongoDB Query:", queryForLog);

    policies = await PoliciesModel.find(
      query,
      "policy_number insured_first_name insured_last_name insured_middle_initial address policy_expiration_date vehicle_manufacturer vehicle_model vehicle_model_year vehicle_vin policy_effective_date risk_address_line_1 risk_address_city risk_address_state risk_address_zip_code vehicles"
    ).limit(10);

    console.log("policies", policies);
    return policies;
  } catch (ex) {
    console.error("Exception in searchPolicyByNameAndNumber:", ex);
    throw ex; // rethrow the error so upstream handlers can catch it
  }
};

exports.createNewPolicy = async (userId, policy) => {
  try {
    // Construct address from policy risk address fields
    const address = [
      policy?.risk_address_line_1,
      policy?.risk_address_city,
      policy?.risk_address_state,
      policy?.risk_address_zip_code,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    // Vehicle query for checking existing policy
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

    // Check for existing policy
    const existingPolicy = await PoliciesModel.findOne({
      policy_number: policy.policy_number,
      insured_first_name: policy.insured_first_name,
      insured_last_name: policy.insured_last_name,
      policy_effective_date: policy.policy_effective_date,
      policy_expiration_date: policy.policy_expiration_date,
      ...vehicleQuery,
    });

    if (existingPolicy) {
      throw new Error("Policy already exists");
    }

    // Fetch user and organization
    const user = await UserModel.findById(userId).populate("role_id");
    if (!user) {
      throw new Error("User not found");
    }

    const userRole = await RoleModel.findById(user.role_id);
    if (!userRole) {
      throw new Error("User role not found");
    }

    // Determine if organization_id should be included based on role
    const exemptRoles = ["admin", "super_admin", "sub_admin", "ai"];
    let organization_id = null;

    if (!exemptRoles.includes(userRole.name)) {
      const userOrg = await OrganizationModel.findOne({ owner: userId });
      if (!userOrg) {
        throw new Error("Organization not found");
      }
      organization_id = userOrg._id;
    }

    // Map vehicles and nest warranties under each vehicle
    // Map vehicles and nest warranties under each vehicle
    const vehicles = (policy.vehicles || []).map((vehicle) => ({
      vehicle_model_year: vehicle.vehicle_model_year,
      vehicle_manufacturer: vehicle.vehicle_manufacturer,
      vehicle_model: vehicle.vehicle_model,
      vehicle_vin: vehicle.vehicle_vin,
      vehicle_color: vehicle.vehicle_color,
      licensePlate: vehicle.licensePlate,
      warranties: (vehicle.warranties || []).map((warranty) => ({
        warrantyNumber: warranty.warrantyNumber,
        coverageType: warranty.coverageType,
        startDate: warranty.startDate,
        endDate: warranty.endDate,
        deductible: warranty.deductible,
        isActive: warranty.isActive,
        isTransferable: warranty.isTransferable,
        terms: warranty.terms,
        coveredParts: (warranty.coveredParts || []).map((part) => ({
          partName: part.partName,
          partNumber: part.partNumber,
          coverageLimit: part.coverageLimit,
          notes: part.notes,
        })),
        authorizedServiceProviders: (
          warranty.authorizedServiceProviders || []
        ).map((provider) => ({
          provider: provider.provider,
          isPrimary: provider.isPrimary,
          laborRate: provider.laborRate,
          authorizationNotes: provider.authorizationNotes,
        })),
      })),
      drivers: vehicle.drivers || [],
    }));

    // Create new policy with all fields from the provided data
    const newPolicy = await PoliciesModel.create({
      agency_name: policy.agency_name,
      coverageLimit: policy.coverageLimit,
      insured_first_name: policy.insured_first_name,
      insured_middle_initial: policy.insured_middle_initial,
      insured_last_name: policy.insured_last_name,
      policy_creation_api_type: policy.policy_creation_api_type || "admin-api",
      policy_effective_date: policy.policy_effective_date,
      policy_expiration_date: policy.policy_expiration_date,
      policy_number: policy.policy_number,
      risk_address_line_1: policy.risk_address_line_1,
      risk_address_city: policy.risk_address_city,
      risk_address_state: policy.risk_address_state,
      risk_address_zip_code: policy.risk_address_zip_code,
      address,
      seller_userid: policy.seller_userid,
      vehicles,
      version: policy.version || 1,
      organization_id,
      added_by: policy.added_by,
    });

    return newPolicy;
  } catch (error) {
    console.error("Error creating new policy:", error.message);
    throw error;
  }
};

exports.updatePolicy = async (policy, policy_id) => {
  let updatedPolicy = null;
  try {
    if (policy?.policy_creation_api_type) {
      delete policy.policy_creation_api_type;
    }
    const address = `${policy?.risk_address_line_1 || ""} ${
      policy?.risk_address_city || ""
    } ${policy?.risk_address_state || ""} ${
      policy?.risk_address_zip_code || ""
    }`;
    updatedPolicy = await PoliciesModel.findByIdAndUpdate(
      { _id: policy_id },
      { ...policy, address },
      { returnDocument: "after" }
    );
  } catch (ex) {
    console.error("exception updatePolicy", ex);
  }
  console.log("updatedPolicy", updatedPolicy);
  return updatedPolicy;
};

exports.getAdminPolicies = async (
  page = 1,
  limit = 10,
  search = "",
  sortField = "createdAt",
  sort = -1,
  client_id = ""
) => {
  const query = {};

  if (search.trim()) {
    console.log("Applying search filter:", search);

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
    select: "",
    page,
    limit,
    sort: { [sortField]: Number(sort) },
  };

  let policies = null;
  try {
    policies = await PoliciesModel.paginate(query, options);
  } catch (ex) {
    console.error("exception getPolicies", ex);
  }
  return policies;
};

exports.getPolicyDetailsById = async (policy_id) => {
  console.log("policy_id", policy_id);
  let policy = null;
  try {
    policy = await PoliciesModel.findById(policy_id);
  } catch (ex) {
    console.error("exception getPolicyDetailsById", ex);
  }
  return policy;
};

exports.validatePolicy = async (policy) => {
  try {
    if (!policy?.policy_number) {
      return {
        message: "The policy number is required",
      };
    }

    console.log(policy.policy_number);
    const query = { policy_number: policy.policy_number };

    const existingPolicy = await PoliciesModel.findOne(query);

    if (!existingPolicy) {
      return {
        exists: false,
        expired: null,
        message: "Policy does not exist",
      };
    }

    const currentDate = moment();
    const expirationDate = moment(
      existingPolicy.policy_expiration_date,
      "MM/DD/YYYY",
      true
    );

    if (expirationDate.isBefore(currentDate)) {
      return {
        exists: true,
        expired: true,
        message: "The policy exists but expired",
      };
    }

    return {
      exists: true,
      expired: false,
      message: "The policy exists and still valid",
    };
  } catch (ex) {
    console.error("exception ValidatePolicies", ex);
    throw ex;
  }
};

exports.getPolicyByNumber = async (policy_number) => {
  try {
    if (!policy_number) {
      return {
        message: "The policy number is required",
      };
    }

    const policy = await PoliciesModel.aggregate([
      {
        $match: {
          policy_number: { $regex: `^${policy_number}$`, $options: "i" },
        },
      },
    ])
      .sort({ createdAt: -1 })
      .limit(1);

    if (!policy) {
      return {
        message: "Policy does not exist",
      };
    }
    // if (!policy[0].client_id) {
    //   policy[0].client_id = "";
    // }

    return {
      data: policy.length ? policy[0] : null,
      message: "The policy exists",
    };
  } catch (ex) {
    console.error("exception ValidatePolicies", ex);
    console.log(ex);
    throw ex.message;
  }
};

exports.getPolicyByClientId = async (client_id, policy_number) => {
  try {
    if (client_id) {
      const policy = await PoliciesModel.find({
        client_id: new mongoose.Types.ObjectId(client_id),
        ...(policy_number ? { policy_number } : {}),
      });
      return policy;
    }
  } catch (ex) {
    console.error("exception ValidatePolicies", ex);
  }
};

/**
 * Get recently created policies for a specific client
 * @param {string} client_id - The client ID to filter by
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Number of policies per page (default: 10)
 * @returns {Promise<Object>} Paginated result of recent policies
 */
exports.getRecentPoliciesPaginated = async (
  client_id,
  page = 1,
  limit = 10
) => {
  try {
    if (!client_id) {
      throw new Error("Client ID is required");
    }

    const query = {
      client_id: new mongoose.Types.ObjectId(client_id),
    };

    const options = {
      page,
      limit,
      sort: { createdAt: -1 },
      select:
        "policy_number insured_first_name insured_last_name policy_expiration_date " +
        "address vehicles " +
        "createdAt client_id",
      populate: {
        path: "client_id", //
        select: "firstname lastname phoneNumber ",
      },
    };

    return await PoliciesModel.paginate(query, options);
  } catch (ex) {
    console.error("exception getRecentPoliciesPaginated", ex);
    throw ex;
  }
};

exports.deletePolicyById = async (policyId) => {
  try {
    const result = await PoliciesModel.deleteOne({
      _id: new mongoose.Types.ObjectId(policyId),
    });

    return result;
  } catch (error) {
    console.error("Database delete error:", error);
    throw error;
  }
};

/**
 * Bulk upload policies with email notifications
 * @param {Array} policies - Array of policy objects to upload
 * @param {string} adminRole - Admin role of the user
 * @param {string} userId - ID of the user performing the upload
 * @param {string} organizationId - ID of the organization
 * @param {string} jobId - Optional job ID for tracking
 * @param {boolean} sendNotifications - Whether to send email notifications (default: true)
 * @returns {Promise<Object>} Result of bulk upload operation
 */
exports.bulkUploadPolicies = async (
  policies,
  adminRole,
  userId,
  organizationId,
  jobId = null,
  sendNotifications = true
) => {
  // Fetch user and organization information for email notifications
  let userInfo = null;
  let organizationInfo = null;
  try {
    console.log(
      `🔄 Starting bulk upload of ${policies.length} policies for organization ${organizationId}`
    );

    if (!Array.isArray(policies) || policies.length === 0) {
      throw new Error("Invalid or empty policies array");
    }

    if (!organizationId) {
      throw new Error("Organization ID is required");
    }

    if (sendNotifications) {
      try {
        userInfo = await UserModel.findById(userId).select(
          "firstname lastname email"
        );
        organizationInfo = await OrganizationModel.findById(
          organizationId
        ).select("companyName owner");

        console.log("userInfo", userInfo);
        console.log("organizationInfo", organizationInfo);

        // If user email is not available, try to get owner's email
        if (!userInfo?.email && organizationInfo?.owner) {
          const ownerInfo = await UserModel.findById(
            organizationInfo.owner
          ).select("email firstname lastname");
          if (ownerInfo?.email) {
            userInfo = ownerInfo;
          }
        }
      } catch (emailError) {
        console.warn(
          "⚠️ Could not fetch user/organization info for email notifications:",
          emailError.message
        );
      }
    }

    console.log("organizationId", organizationId);

    // Check if organization has shouldUpsertPolicies enabled
    const organization = await OrganizationModel.findById(organizationId);

    if (!organization) {
      throw new Error("Organization not found");
    }

    const shouldUpsert = organization.shouldUpsertPolicies;
    const mode = shouldUpsert ? "upsert" : "individual";
    console.log(
      `📋 Organization upsert mode: ${shouldUpsert ? "ENABLED" : "DISABLED"}`
    );

    // Send start notification email
    if (sendNotifications && userInfo?.email) {
      try {
        const estimatedTime = shouldUpsert
          ? `${Math.ceil(policies.length / 1000)} minutes`
          : `${Math.ceil(policies.length / 10)} minutes`;

        await sendPolicyUploadStartedEmail(
          userInfo.email,
          {
            jobId: jobId || `bulk-${Date.now()}`,
            totalRecords: policies.length,
            estimatedProcessingTime: estimatedTime,
            mode: mode,
          },
          organizationInfo || { companyName: "Unknown Organization" },
          userInfo
        );
        console.log(`📧 Start notification email sent to ${userInfo.email}`);
      } catch (emailError) {
        console.warn(
          "⚠️ Failed to send start notification email:",
          emailError.message
        );
      }
    }

    let successful = [];
    let failed = [];
    const startTime = Date.now();

    if (shouldUpsert) {
      // Upsert mode: Delete all existing policies and batch insert new ones
      console.log(
        `🗑️ Deleting all existing policies for organization ${organizationId}`
      );

      const deleteResult = await PoliciesModel.deleteMany({
        organization_id: organizationId,
      });
      console.log(`✅ Deleted ${deleteResult.deletedCount} existing policies`);

      // Prepare policies for batch insert
      const policiesToInsert = [];

      for (let i = 0; i < policies.length; i++) {
        const policy = policies[i];

        try {
          // Validate required fields
          if (!policy.policy_number) {
            throw new Error("Policy number is required");
          }

          // Construct address from risk address fields
          const address = [
            policy.risk_address_line_1,
            policy.risk_address_city,
            policy.risk_address_state,
            policy.risk_address_zip_code,
          ]
            .filter(Boolean)
            .join(" ")
            .trim();

          // Create new policy object with organization ID
          const newPolicyData = {
            policy_number: policy.policy_number,
            insured_first_name: policy.insured_first_name,
            insured_last_name: policy.insured_last_name,
            insured_middle_initial: policy.insured_middle_initial,
            policy_effective_date: policy.policy_effective_date,
            policy_expiration_date: policy.policy_expiration_date,
            agency_name: policy.agency_name,
            risk_address_line_1: policy.risk_address_line_1,
            risk_address_city: policy.risk_address_city,
            risk_address_state: policy.risk_address_state,
            risk_address_zip_code: policy.risk_address_zip_code,
            address,
            vehicles: policy.vehicles || [],
            vehicle_manufacturer: policy.vehicle_manufacturer,
            vehicle_model: policy.vehicle_model,
            vehicle_model_year: policy.vehicle_model_year,
            vehicle_vin: policy.vehicle_vin,
            vehicle_color: policy.vehicle_color,
            licensePlate: policy.licensePlate,
            organization_id: organizationId,
            version: policy.version || 1,
            added_by: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          policiesToInsert.push(newPolicyData);
        } catch (error) {
          console.error(
            `❌ Error preparing policy ${policy.policy_number || "unknown"}:`,
            error.message
          );

          failed.push({
            policy_number: policy.policy_number || "unknown",
            error: error.message,
            success: false,
          });
        }
      }

      // Batch insert policies in chunks of 1000
      const BATCH_SIZE = 1000;
      console.log(
        `📦 Batch inserting ${policiesToInsert.length} policies in chunks of ${BATCH_SIZE}`
      );

      for (let i = 0; i < policiesToInsert.length; i += BATCH_SIZE) {
        const batch = policiesToInsert.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(policiesToInsert.length / BATCH_SIZE);

        try {
          console.log(
            `📋 Processing batch ${batchNumber}/${totalBatches} (${batch.length} policies)`
          );

          const insertedPolicies = await PoliciesModel.insertMany(batch, {
            ordered: false,
          });

          // Add successful policies to the result
          insertedPolicies.forEach((policy) => {
            successful.push({
              policy_number: policy.policy_number,
              id: policy._id,
              success: true,
            });
          });

          console.log(
            `✅ Successfully inserted batch ${batchNumber}/${totalBatches} (${insertedPolicies.length} policies)`
          );
        } catch (error) {
          console.error(
            `❌ Error inserting batch ${batchNumber}/${totalBatches}:`,
            error.message
          );

          // Handle individual failures in batch
          if (error.writeErrors) {
            error.writeErrors.forEach((writeError) => {
              const failedPolicy = batch[writeError.index];
              failed.push({
                policy_number: failedPolicy.policy_number || "unknown",
                error: writeError.errmsg || "Batch insert error",
                success: false,
              });
            });

            // Add successful ones from this batch
            batch.forEach((policy, index) => {
              const hasError = error.writeErrors.some(
                (we) => we.index === index
              );
              if (!hasError) {
                successful.push({
                  policy_number: policy.policy_number,
                  id: "batch_inserted",
                  success: true,
                });
              }
            });
          } else {
            // If entire batch failed, mark all as failed
            batch.forEach((policy) => {
              failed.push({
                policy_number: policy.policy_number || "unknown",
                error: error.message || "Batch insert failed",
                success: false,
              });
            });
          }
        }
      }
    } else {
      // Original mode: Individual validation and insertion
      console.log(`📋 Processing policies individually with validation`);

      for (let i = 0; i < policies.length; i++) {
        const policy = policies[i];

        try {
          console.log(
            `📋 Processing policy ${i + 1}/${policies.length}: ${
              policy.policy_number || "No policy number"
            }`
          );

          // Validate required fields
          if (!policy.policy_number) {
            throw new Error("Policy number is required");
          }

          // Construct address from risk address fields
          const address = [
            policy.risk_address_line_1,
            policy.risk_address_city,
            policy.risk_address_state,
            policy.risk_address_zip_code,
          ]
            .filter(Boolean)
            .join(" ")
            .trim();

          // Check for existing policy with same policy number and organization
          const existingPolicy = await PoliciesModel.findOne({
            policy_number: policy.policy_number,
            organization_id: organizationId,
          });

          if (existingPolicy) {
            throw new Error(
              `Policy with number ${policy.policy_number} already exists in this organization`
            );
          }

          // Create new policy object with organization ID
          const newPolicyData = {
            policy_number: policy.policy_number,
            insured_first_name: policy.insured_first_name,
            insured_last_name: policy.insured_last_name,
            insured_middle_initial: policy.insured_middle_initial,
            policy_effective_date: policy.policy_effective_date,
            policy_expiration_date: policy.policy_expiration_date,
            agency_name: policy.agency_name,
            risk_address_line_1: policy.risk_address_line_1,
            risk_address_city: policy.risk_address_city,
            risk_address_state: policy.risk_address_state,
            risk_address_zip_code: policy.risk_address_zip_code,
            address,
            vehicles: policy.vehicles || [],
            vehicle_manufacturer: policy.vehicle_manufacturer,
            vehicle_model: policy.vehicle_model,
            vehicle_model_year: policy.vehicle_model_year,
            vehicle_vin: policy.vehicle_vin,
            vehicle_color: policy.vehicle_color,
            licensePlate: policy.licensePlate,
            organization_id: organizationId,
            version: policy.version || 1,
            added_by: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Save the policy
          const savedPolicy = await PoliciesModel.create(newPolicyData);

          successful.push({
            policy_number: policy.policy_number,
            id: savedPolicy._id,
            success: true,
          });

          console.log(`✅ Successfully saved policy: ${policy.policy_number}`);
        } catch (error) {
          console.error(
            `❌ Error processing policy ${policy.policy_number || "unknown"}:`,
            error.message
          );

          failed.push({
            policy_number: policy.policy_number || "unknown",
            error: error.message,
            success: false,
          });
        }
      }
    }

    const endTime = Date.now();
    const processingTimeMs = endTime - startTime;
    const processingTimeMinutes =
      Math.round((processingTimeMs / 60000) * 100) / 100;

    const result = {
      message: "Policies bulk upload completed",
      mode: mode,
      summary: {
        total: policies.length,
        successful: successful.length,
        failed: failed.length,
        successRate: `${((successful.length / policies.length) * 100).toFixed(
          2
        )}%`,
        processingTime: `${processingTimeMinutes} minutes`,
      },
      successful,
      failed: failed.length > 0 ? failed : undefined,
      count: successful.length,
      uploaded: successful,
      organizationId,
      processedAt: new Date(),
      jobId: jobId || `bulk-${Date.now()}`,
    };

    console.log(
      `📊 Bulk upload completed: ${successful.length}/${
        policies.length
      } policies uploaded successfully (Mode: ${
        shouldUpsert ? "UPSERT" : "INDIVIDUAL"
      }) in ${processingTimeMinutes} minutes`
    );

    // Send completion notification email
    if (sendNotifications && userInfo?.email) {
      try {
        await sendPolicyUploadCompletionEmail(
          userInfo.email,
          result,
          organizationInfo || { companyName: "Unknown Organization" },
          userInfo
        );
        console.log(
          `📧 Completion notification email sent to ${userInfo.email}`
        );
      } catch (emailError) {
        console.warn(
          "⚠️ Failed to send completion notification email:",
          emailError.message
        );
        // Don't fail the entire operation if email fails
      }
    }

    return result;
  } catch (error) {
    console.error("❌ Error in bulkUploadPolicies:", error);

    // Send failure notification email if possible
    if (sendNotifications && userInfo?.email) {
      try {
        const failureResult = {
          message: "Policies bulk upload failed",
          mode: "unknown",
          summary: {
            total: policies?.length || 0,
            successful: 0,
            failed: policies?.length || 0,
            successRate: "0%",
            processingTime: "0 minutes",
          },
          failed: [
            { policy_number: "N/A", error: error.message, success: false },
          ],
          organizationId,
          processedAt: new Date(),
          jobId: jobId || `bulk-${Date.now()}`,
        };

        await sendPolicyUploadCompletionEmail(
          userInfo.email,
          failureResult,
          organizationInfo || { companyName: "Unknown Organization" },
          userInfo
        );
        console.log(`📧 Failure notification email sent to ${userInfo.email}`);
      } catch (emailError) {
        console.warn(
          "⚠️ Failed to send failure notification email:",
          emailError.message
        );
      }
    }

    throw new Error(`Bulk upload failed: ${error.message}`);
  }
};
