const {
  Organization,
  User,
  Role,
  AIConfig,
  Driver,
  DriverPortalSettings,
  Policy,
} = require("../models");
const {
  Types: { ObjectId },
} = require("mongoose");
const organizationSetupService = require("./organizationSetup.service");
const { generateRandomPassword } = require("../helper");
const { sendUserInviteEmail } = require("./mail/approvalmail");
const aiConfigService = require("./aiConfig.service");
const twilioService = require("./twilio.service");
const vapiService = require("./vapi.service");
const {
  sendAiConciergeEmail,
  sendAiDispatchEmail,
} = require("./mail/conformationmail");

// Create a new organization
exports.createOrganization = async (organizationData, clientId, orgType) => {
  const requiredFields = ["clientId", "orgType"];
  for (const field of requiredFields) {
    if (!organizationData[field]) throw new Error(`${field} is required`);
  }

  const { clientId: ownerId } = organizationData;
  // Check if clientId is valid
  const client = await User.findById(ownerId);
  if (!client) throw new Error("Client not found");

  // Check if organization already exists by ownerId
  const existingOrganization = await Organization.findOne({ owner: ownerId });
  if (existingOrganization)
    throw new Error("Organization with this name already exists");

  const newOrganization = await Organization.create({
    owner: ownerId,
    createdByManual: true,
    organization_type: orgType,
  });

  return newOrganization;
};

exports.createOrgByAdmin = async (organizationData, clientId) => {
  const { name, email, phone, role_id } = organizationData;
  const createdBy = clientId;

  const role = await Role.findOne({ name: role_id });
  if (!role) throw new Error("Role not found");
  // agentData.role_id = role._id;

  const rawPassword = generateRandomPassword(16);
  console.log(rawPassword);

  // Create new user document
  const newUser = await User.create({
    password: rawPassword,
    createdBy: createdBy || null,
    createdByManual: true,
    isInvited: true,
    inVitedAt: new Date(),
    invitedBy: createdBy || null,
    status: "approved",
    firstname: name,
    phoneNumber: phone,
    email: email,
    role_id: role._id,
  });

  await sendUserInviteEmail({
    email: email,
    firstName: newUser.firstname,
    password: rawPassword,
    clientType: role.name,
  });

  const newOrganization = await Organization.create({
    ...organizationData,
    createdByManual: true,
    owner: newUser._id,
    status: "verified"
  });

  return newOrganization;
};

// Get all organizations
exports.getAllOrganizations = async () => {
  return await Organization.find({})
    .populate("owner", "-password")
    .populate("members.user", "-password");
};

// Get organization details by ID
exports.getOrganizationById = async (orgId) => {
  return await Organization.findById(orgId)
    .populate("owner", "members.userId")
    .exec();
};

// Update organization details
exports.updateOrganization = async (orgId, organizationData) => {
  console.log("organizationData", organizationData);
  const organization = await Organization.findById(orgId);
  if (!organization) throw new Error("Organization not found");

  // Check if inboundAi is being updated
  const inboundAiChanged =
    organizationData.hasOwnProperty("inboundAi") &&
    organization.inboundAi !== organizationData.inboundAi;

  // Store the old value for comparison
  const oldInboundAi = organization.inboundAi;
  // Update organization data
  Object.assign(organization, organizationData);
  await organization.save();

  // Handle phone number management based on inboundAi setting
  if (inboundAiChanged) {
    console.log(
      `🔄 InboundAi setting changed from ${oldInboundAi} to ${organization.inboundAi}`
    );

    try {
      if (organization.inboundAi) {
        // inboundAi is now true - check if phone number exists
        console.log(
          `📞 Checking phone number status for organization: ${orgId}`
        );

        const aiConfig = await aiConfigService.getAIConfigByOrganizationId(
          orgId
        );

        if (!aiConfig || !aiConfig.number) {
          // No phone number exists - buy one and setup VAPI
          console.log(
            `🆕 No phone number found - purchasing new phone number for organization: ${orgId}`
          );

          const orgName =
            organization.companyName ||
            organization.name ||
            `Organization-${orgId.slice(-8)}`;

          // Purchase phone number
          const phoneNumberData =
            await twilioService.buyPhoneNumberForOrganization(
              orgName,
              "US" // Default country code
            );

          // const phoneNumberData = {
          //   phone_number: "+13022731275",
          //   sid: "AC1234567890123456789012347677yu9w73",
          // };

          console.log(
            `✅ Phone number purchased: ${phoneNumberData.phone_number}`
          );

          // Check if assistants already exist
          let inboundAssistant, outboundAssistant;

          if (
            aiConfig &&
            aiConfig.inbound_assistant_id &&
            aiConfig.outbound_assistant_id
          ) {
            // Use existing assistants
            console.log(
              `🔄 Using existing assistants for organization: ${orgId}`
            );
            inboundAssistant = { id: aiConfig.inbound_assistant_id };
            outboundAssistant = { id: aiConfig.outbound_assistant_id };

            console.log(
              `✅ Using existing assistants - Inbound: ${inboundAssistant.id}, Outbound: ${outboundAssistant.id}`
            );
          } else {
            // Create new VAPI assistants
            console.log(
              `🆕 Creating new VAPI assistants for organization: ${orgId}`
            );
            inboundAssistant = await vapiService.createInboundAssistant(
              orgName,
              orgId
            );
            outboundAssistant = await vapiService.createOutboundAssistant(
              orgName,
              orgId
            );
            console.log(
              `✅ VAPI assistants created - Inbound: ${inboundAssistant.id}, Outbound: ${outboundAssistant.id}`
            );
          }

          // Register phone number with VAPI
          const vapiPhoneNumber = await vapiService.registerPhoneNumber(
            phoneNumberData.phone_number,
            inboundAssistant.id,
            orgName,
            "inbound"
          );

          console.log(
            `✅ Phone number registered with VAPI: ${vapiPhoneNumber.id}`
          );

          // Save or update AI configuration
          const aiConfigData = {
            client_id: organization.owner,
            organization_id: orgId,
            outbound_assistant_id: outboundAssistant.id,
            inbound_assistant_id: inboundAssistant.id,
            number: phoneNumberData.phone_number,
            phone_number_sid: phoneNumberData.sid,
            vapi_phone_number_id: vapiPhoneNumber.id,
            status: "active",
            setup_completed: true,
            setup_date: new Date(),
          };

          if (aiConfig) {
            // Update existing config
            await aiConfigService.updateAIConfig(aiConfig._id, aiConfigData);
            console.log(
              `✅ AI configuration updated for organization: ${orgId}`
            );
          } else {
            // Create new config
            await aiConfigService.createAIConfig(aiConfigData);
            console.log(
              `✅ AI configuration created for organization: ${orgId}`
            );
          }
        } else {
          // Phone number already exists - just ensure it's active
          console.log(`✅ Phone number already exists: ${aiConfig.number}`);

          if (aiConfig.status !== "active") {
            await aiConfigService.updateAIConfig(aiConfig._id, {
              status: "active",
            });
            console.log(
              `✅ AI configuration activated for organization: ${orgId}`
            );
          }
        }
      } else {
        // inboundAi is now false - release phone number from both VAPI and Twilio
        console.log(
          `🚫 InboundAi disabled - releasing phone number for organization: ${orgId}`
        );

        const aiConfig = await aiConfigService.getAIConfigByOrganizationId(
          orgId
        );

        if (aiConfig) {
          try {
            // Delete VAPI phone number registration
            if (aiConfig.vapi_phone_number_id) {
              await vapiService.deletePhoneNumber(
                aiConfig.vapi_phone_number_id
              );
              console.log(
                `✅ VAPI phone number released: ${aiConfig.vapi_phone_number_id}`
              );
            }

            // Release Twilio phone number
            if (aiConfig.phone_number_sid) {
              await twilioService.releasePhoneNumber(aiConfig.phone_number_sid);
              console.log(
                `✅ Twilio phone number released: ${aiConfig.phone_number_sid}`
              );
            }

            // Update AI config status to inactive and clear phone number data
            await aiConfigService.updateAIConfig(aiConfig._id, {
              status: "inactive",
              setup_completed: false,
              number: null,
              phone_number_sid: null,
              vapi_phone_number_id: null,
            });
            console.log(
              `✅ AI configuration deactivated and phone number data cleared for organization: ${orgId}`
            );
          } catch (error) {
            console.error(
              `❌ Failed to release phone number: ${error.message}`
            );
            // Don't throw error to avoid breaking the organization update
          }
        } else {
          console.log(
            `ℹ️ No AI configuration found to release for organization: ${orgId}`
          );
        }
      }
    } catch (error) {
      console.error(
        `❌ Error managing phone number for organization ${orgId}:`,
        error.message
      );
      // Don't throw error to avoid breaking the organization update
      // The phone number management is a side effect, not critical to the update
    }
  }

  if (organization.outboundAi === true) {
    const aiConfig = await aiConfigService.getAIConfigByOrganizationId(orgId);
    const owner = await User.findById(organization?.owner);

    const email = owner?.email;
    const orgName =
      organization.companyName || organization?.keyBillingContactName;
    const outboundNumber = aiConfig?.number || "the AI number";

    await sendAiDispatchEmail(email, orgName, outboundNumber);
  }

  if (organization.inboundAi === true) {
    const aiConfig = await aiConfigService.getAIConfigByOrganizationId(orgId);
    const orgName =
      organization.companyName || organization?.keyBillingContactName;
    const owner = await User.findById(organization?.owner);
    const email = owner?.email;
    const phone = aiConfig?.number || "No Number Yet - contact support";

    await sendAiConciergeEmail(email, orgName, phone);
  }

  return organization;
};

// Delete organization by ID
exports.deleteOrganizationById = async (orgId) => {
  const organization = await Organization.findByIdAndDelete(orgId);
  if (!organization) throw new Error("Organization not found");
  return organization;
};

// Add member to organization
exports.addMemberToOrganization = async (orgId, userId, role = "member") => {
  const organization = await Organization.findById(orgId);
  if (!organization) throw new Error("Organization not found");

  const existingMember = organization.members.find(
    (member) => member.userId.toString() === userId.toString()
  );

  if (existingMember) throw new Error("User is already a member");

  organization.members.push({ userId: ObjectId(userId), role });
  await organization.save();
  return organization;
};

// Remove member from organization
exports.removeMemberFromOrganization = async (orgId, userId) => {
  const organization = await Organization.findById(orgId);
  if (!organization) throw new Error("Organization not found");

  const memberIndex = organization.members.findIndex(
    (member) => member.userId.toString() === userId.toString()
  );

  if (memberIndex === -1)
    throw new Error("User is not a member of this organization");

  organization.members.splice(memberIndex, 1);
  await organization.save();
  return organization;
};

// Get organizations by owner ID
exports.getOrganizationsByOwnerId = async (clientId) => {
  const org = await Organization.find({
    $or: [{ owner: { $in: clientId } }, { "members.user": { $in: clientId } }],
  });
  if (!org) {
    return null;
  }

  let result;
  const aiConfig = await AIConfig.findOne({ organization_id: org._id });
  if (typeof org.toObject === "function") {
    result = org.toObject();
  } else {
    result = org;
  }
  result.ai_number = aiConfig ? aiConfig.number : null;

  return result;
};

// Get organizations by policy
exports.getOrganizationsByPolicy = async (policy) => {
  const PolicyData = await Policy.findOne({ policy_number: policy });
  if (!PolicyData) {
    throw new Error("Policy not found");
  }
  const org = await Organization.findById(PolicyData.organization_id);
  if (!org) {
    throw new Error("Organization not found");
  }

  let result;
  result = org.companyName;

  return result;
};

/**
 * Verify organization and setup AI configuration if approved for the first time
 * @param {string} orgId - Organization ID
 * @param {string} status - New status ('verified', 'rejected', etc.)
 * @param {Object} options - Additional options for AI setup
 * @returns {Promise<Object>} Updated organization with setup results
 */
exports.verifyOrganization = async (orgId, status, options = {}) => {
  const organization = await Organization.findById(orgId);
  if (!organization) throw new Error("Organization not found");

  console.log("🔍 Organization verification:", {
    orgId,
    currentStatus: organization.status,
    newStatus: status,
  });

  // Check if this is the first time being approved
  const wasNotVerifiedBefore =
    !organization.isVerified && organization.status !== "verified";
  const isBeingApproved = status === "verified";
  const shouldSetupAI = wasNotVerifiedBefore && isBeingApproved;

  // Update organization status
  organization.isVerified = status === "verified";
  organization.status = status;
  await organization.save();

  console.log(`✅ Organization status updated: ${status}`);

  let aiSetupResult = null;

  // Setup AI configuration if being approved for the first time
  if (shouldSetupAI) {
    console.log(
      `🚀 Organization approved for the first time - triggering AI setup...`
    );

    try {
      // Setup AI configuration in the background
      aiSetupResult = await organizationSetupService.setupOrganizationAI(
        orgId,
        {
          countryCode: options.countryCode || "US",
          ...(options.areaCode ? { areaCode: options.areaCode } : {}),
          ...options,
        }
      );

      if (aiSetupResult.success) {
        console.log(
          `🎉 AI setup completed successfully for organization: ${orgId}`
        );
      } else {
        console.error(
          `❌ AI setup failed for organization: ${orgId}`,
          aiSetupResult.error
        );
      }
    } catch (setupError) {
      console.error(
        `❌ AI setup error for organization: ${orgId}`,
        setupError.message
      );
      aiSetupResult = {
        success: false,
        error: setupError.message,
        step: "setup_initiation",
      };
    }
  } else {
    console.log(
      `ℹ️ AI setup not triggered - wasNotVerifiedBefore: ${wasNotVerifiedBefore}, isBeingApproved: ${isBeingApproved}`
    );
  }

  return {
    organization,
    aiSetup: aiSetupResult,
  };
};

/**
 * Get organization with AI setup status
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} Organization with AI setup status
 */
exports.getOrganizationWithAIStatus = async (orgId) => {
  const organization = await Organization.findById(orgId).populate("owner");
  if (!organization) throw new Error("Organization not found");

  const aiSetupStatus = await organizationSetupService.getSetupStatus(orgId);

  return {
    organization,
    aiSetup: aiSetupStatus,
  };
};

/**
 * Retry AI setup for an organization
 * @param {string} orgId - Organization ID
 * @param {Object} options - Setup options
 * @returns {Promise<Object>} Retry result
 */
exports.retryAISetup = async (orgId, options = {}) => {
  const organization = await Organization.findById(orgId);
  if (!organization) throw new Error("Organization not found");

  if (!organization.isVerified || organization.status !== "verified") {
    throw new Error("Organization must be verified before setting up AI");
  }

  console.log(`🔄 Retrying AI setup for organization: ${orgId}`);

  const retryResult = await organizationSetupService.retrySetup(orgId, options);

  return {
    organization,
    aiSetup: retryResult,
  };
};

/**
 * Cleanup AI configuration for an organization
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} Cleanup result
 */
exports.cleanupAISetup = async (orgId) => {
  const organization = await Organization.findById(orgId);
  if (!organization) throw new Error("Organization not found");

  console.log(`🧹 Cleaning up AI setup for organization: ${orgId}`);

  const cleanupResult = await organizationSetupService.cleanupOrganizationAI(
    orgId
  );

  return {
    organization,
    cleanup: cleanupResult,
  };
};

/**
 * Enable or disable policy upsert mode for an organization
 * @param {string} orgId - Organization ID
 * @param {boolean} shouldUpsert - Whether to enable upsert mode
 * @returns {Promise<Object>} Updated organization
 */
exports.setShouldUpsertPolicies = async (orgId, shouldUpsert) => {
  const organization = await Organization.findById(orgId);
  if (!organization) throw new Error("Organization not found");

  organization.shouldUpsertPolicies = shouldUpsert;
  await organization.save();

  console.log(
    `📋 Organization ${orgId} upsert mode ${
      shouldUpsert ? "ENABLED" : "DISABLED"
    }`
  );
  return organization;
};

/**
 * Get organization upsert policy setting
 * @param {string} orgId - Organization ID
 * @returns {Promise<boolean>} Whether upsert is enabled
 */
exports.getShouldUpsertPolicies = async (orgId) => {
  const organization = await Organization.findById(orgId);
  if (!organization) throw new Error("Organization not found");

  return organization.shouldUpsertPolicies || false;
};

/**
 * Bulk enable/disable upsert mode for multiple organizations
 * @param {Array<string>} orgIds - Array of organization IDs
 * @param {boolean} shouldUpsert - Whether to enable upsert mode
 * @returns {Promise<Object>} Update result
 */
exports.bulkSetShouldUpsertPolicies = async (orgIds, shouldUpsert) => {
  if (!Array.isArray(orgIds) || orgIds.length === 0) {
    throw new Error("Organization IDs array is required");
  }

  const result = await Organization.updateMany(
    { _id: { $in: orgIds } },
    { shouldUpsertPolicies: shouldUpsert }
  );

  console.log(
    `📋 Bulk updated ${result.modifiedCount} organizations - upsert mode ${
      shouldUpsert ? "ENABLED" : "DISABLED"
    }`
  );

  return {
    modifiedCount: result.modifiedCount,
    matchedCount: result.matchedCount,
    shouldUpsert,
  };
};

// GET/CREATE driver portal settings for given org ID.
exports.getSettingsByOrgId = async (orgId) => {
  try {
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new Error("Organization not found");
    }

    let settings = await DriverPortalSettings.findOne({
      organization_id: org._id,
    }).lean();
    if (!settings) {
      // Create default settings
      settings = await DriverPortalSettings.create({
        organization_id: org._id,
        urlPath: org.companyName
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, ""),
        subscriptionCost: 9.99,
        oneTimeCost: 25,
        paymentType: "percentage",
        percentageValue: 20,
        flatFeeValue: 8,
        stripeConnected: org.stripe_connect?.account_id ? false : true,
      });
      settings = settings.toObject();

      org.urlSlug = settings.urlPath;
      await org.save();
    }
    return {
      success: true,
      data: settings,
    };
  } catch (err) {
    console.error("Error in getSettingsByOrgId:", err);
    throw new Error("Server error");
  }
};

/**
 * UPDATE driver portal settings for given org ID.
 * Expects body fields matching the schema.
 */
exports.updateSettingsByOrgId = async (orgId, driverData) => {
  try {
    const {
      urlPath,
      subscriptionCost,
      oneTimeCost,
      paymentType,
      percentageValue,
      flatFeeValue,
      stripeConnected,
    } = driverData;

    const org = await Organization.findById(orgId);
    if (!org) {
      throw new Error("Organization not found");
    }

    let settings = await Driver.findOne({ organization_id: org._id });
    if (!settings) {
      settings = new Driver({ organization_id: org._id });
    }

    // Update fields
    if (typeof urlPath === "string") settings.urlPath = urlPath.trim();
    if (typeof subscriptionCost !== "undefined")
      settings.subscriptionCost = Number(subscriptionCost);
    if (typeof oneTimeCost !== "undefined")
      settings.oneTimeCost = Number(oneTimeCost);
    if (
      typeof paymentType === "string" &&
      ["percentage", "flat"].includes(paymentType)
    )
      settings.paymentType = paymentType;
    if (typeof percentageValue !== "undefined")
      settings.percentageValue = Number(percentageValue);
    if (typeof flatFeeValue !== "undefined")
      settings.flatFeeValue = Number(flatFeeValue);
    if (typeof stripeConnected !== "undefined")
      settings.stripeConnected = Boolean(stripeConnected);

    await settings.save();
    return {
      success: true,
      data: settings.toObject(),
    };
  } catch (err) {
    console.error("Error in updateSettingsByOrgId:", err);
    throw new Error("Server error", err);
  }
};

exports.setUpDriverPortal = async (orgId, data) => {
  try {
    const org = await Organization.findById(orgId);
    if (!org) {
      throw new Error("Organization not found");
    }

    const { urlPath: urlSlug } = data;

    if (typeof urlSlug !== "string" || !urlSlug.trim()) {
      throw new Error("urlSlug is required");
    }

    if (urlSlug.trim().length < 3) {
      throw new Error("urlSlug must be at least 3 characters long");
    }

    const existingOrg = await Organization.findOne({
      urlSlug,
      _id: { $ne: orgId },
    });
    if (existingOrg) {
      throw new Error("urlSlug already in use");
    }

    org.urlSlug = urlSlug.trim();
    const savedOrg = await org.save();

    let driverPortalSettings = await DriverPortalSettings.findOne({
      organization_id: orgId,
    });

    const {
      subscriptionCost,
      oneTimeCost,
      paymentType,
      percentageValue,
      flatFeeValue,
      stripeConnected,
    } = data;

    if (!driverPortalSettings) {
      console.log("driverPortalSettings not found, creating new one");
      driverPortalSettings = new DriverPortalSettings({
        organization_id: orgId,
        urlPath: urlSlug,
      });
    }

    // Update fields
    if (typeof subscriptionCost !== "undefined")
      driverPortalSettings.subscriptionCost = Number(subscriptionCost);
    if (typeof oneTimeCost !== "undefined")
      driverPortalSettings.oneTimeCost = Number(oneTimeCost);
    if (
      typeof paymentType === "string" &&
      ["percentage", "flat"].includes(paymentType)
    )
      driverPortalSettings.paymentType = paymentType;
    if (typeof percentageValue !== "undefined")
      driverPortalSettings.percentageValue = Number(percentageValue);
    if (typeof flatFeeValue !== "undefined")
      driverPortalSettings.flatFeeValue = Number(flatFeeValue);

    driverPortalSettings.stripeConnected = org.stripe_connect?.account_id
      ? false
      : true;

    driverPortalSettings.urlPath = urlSlug;

    const savedDriverPortalSettings = await driverPortalSettings.save();
    console.log("savedDriverPortalSettings", savedDriverPortalSettings);

    return {
      success: true,
      data: {
        urlSlug: savedOrg.urlSlug,
      },
    };
  } catch (error) {
    console.error("Error in setUpDriverPortal:", error);
    throw new Error(error.message || "Server error");
  }
};

exports.verifyOrganizationUrlSlug = async (urlSlug) => {
  const org = await Organization.findOne({ urlSlug });
  if (!org) {
    throw new Error("Organization not found");
  }

  // Get driver portal settings for pricing information
  let driverPortalSettings = await DriverPortalSettings.findOne({
    organization_id: org._id,
  });

  // If no settings exist, create default settings
  if (!driverPortalSettings) {
    driverPortalSettings = await DriverPortalSettings.create({
      organization_id: org._id,
      urlPath:
        org.companyName
          ?.toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "") || urlSlug,
      subscriptionCost: 9.99,
      oneTimeCost: 25,
      paymentType: "percentage",
      percentageValue: 20,
      flatFeeValue: 8,
      stripeConnected: org.stripe_connect?.account_id ? false : true,
    });
  }

  return {
    organizationName: org.companyName,
    organizationId: org._id.toString(),
    driverPortalPrices: {
      subscriptionCost: driverPortalSettings.subscriptionCost,
      oneTimeCost: driverPortalSettings.oneTimeCost,
      paymentType: driverPortalSettings.paymentType,
      percentageValue: driverPortalSettings.percentageValue,
      flatFeeValue: driverPortalSettings.flatFeeValue,
      serviceFee: {
        type: driverPortalSettings.paymentType,
        value:
          driverPortalSettings.paymentType === "percentage"
            ? driverPortalSettings.percentageValue
            : driverPortalSettings.flatFeeValue,
      },
    },
    urlSlug: org.urlSlug,
    isValid: org.urlSlug === urlSlug,
  };
};

/**
 * PUT update urlPath for orgId.
 * PUT /api/v1/organizations/:orgId/driver/url
 * Body: { urlPath: string }
 */
exports.updateReferralPath = async (orgId, urlPath) => {
  try {
    if (typeof urlPath !== "string" || !urlPath.trim()) {
      return { success: false, message: "urlPath is required" };
    }
    const trimmed = urlPath.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(trimmed)) {
      return {
        success: false,
        message: "urlPath must be lowercase letters, numbers, hyphens only",
      };
    }

    // Check uniqueness across other settings
    const existing = await Driver.findOne({
      urlPath: trimmed,
      organization_id: { $ne: orgId },
    }).lean();
    if (existing) {
      return {
        success: false,
        message: "This referral path is already in use",
      };
    }

    let settings = await Driver.findOne({ organization_id: orgId });
    if (!settings) {
      // ensure org exists
      const org = await Organization.findById(orgId).lean();
      if (!org) {
        return { success: false, message: "Organization not found" };
      }
      settings = new Driver({ organization_id: orgId });
    }
    settings.urlPath = trimmed;
    await settings.save();
    return {
      success: true,
      data: {
        urlPath: settings.urlPath,
      },
    };
  } catch (err) {
    console.error("Error in updateurlPath:", err);
    if (err.code === 11000) {
      return { success: false, message: "Referral path already in use" };
    }
    return { success: false, message: "Server error" };
  }
};

/**
 * GET resolve urlPath -> organizationId
 * GET /api/v1/driver/:urlPath
 */
exports.resolveReferralPath = async (urlPath) => {
  try {
    if (typeof urlPath !== "string" || !urlPath.trim()) {
      return { success: false, message: "Invalid referral path" };
    }
    const trimmed = urlPath.trim().toLowerCase();
    const settings = await Driver.findOne({ urlPath: trimmed }).lean();
    if (!settings) {
      return { success: false, message: "Referral link not found" };
    }
    const org = await Organization.findById(settings.organization_id)
      .select("_id companyName")
      .lean();
    if (!org) {
      return { success: false, message: "Organization not found" };
    }
    return {
      success: true,
      data: {
        organizationId: org._id,
        businessName: org.companyName,
      },
    };
  } catch (err) {
    console.error("Error in resolveurlPath:", err);
    return { success: false, message: "Server error" };
  }
};

exports.enableMarketing = async (orgId, hasMarketingEnabled, areaCode) => {
  const org = await Organization.findById(orgId);
  if (!org) {
    throw new Error("Organization not found");
  }
  org.hasMarketingEnabled = hasMarketingEnabled;
  org.marketingEnabledAt = new Date();
  await org.save();
  let aiConfig = await aiConfigService.getAIConfigByOrganizationId(orgId);
  if (!aiConfig) {
    console.log("AI configuration not found, creating new one");
    aiConfig = new AIConfig({
      organization_id: orgId,
      client_id: org.owner,
    });
    await aiConfig.save();
  }
  if (
    aiConfig.markerting_agents.inbound &&
    aiConfig.markerting_agents.outbound &&
    aiConfig.markerting_agents.web
  ) {
    return org;
  }
  const marketingAgents = await vapiService.createMarketingAgents(
    org.companyName,
    orgId
  );

  const phoneNumberData = await twilioService.buyPhoneNumberForOrganization(
    org.companyName,
    "US",
    areaCode
  );

  console.log(`✅ Phone number purchased: ${phoneNumberData.phone_number}`);

  console.log(`🤖 Creating VAPI assistants for ${org.companyName}...`);

  console.log(`📱 Registering phone number with VAPI...`);

  const vapiPhoneNumber = await vapiService.registerPhoneNumber(
    phoneNumberData.phone_number,
    marketingAgents.inbound.id,
    org.companyName,
    "marketing"
  );

  console.log(`✅ Phone number registered with VAPI: ${vapiPhoneNumber.id}`);
  aiConfig.markerting_agents = {
    inbound: marketingAgents.inbound.id,
    outbound: marketingAgents.outbound.id,
    web: marketingAgents.web.id,
    phone_number: phoneNumberData.phone_number,
    phone_number_sid: phoneNumberData.sid,
  };
  await aiConfig.save();
  return org;
};

exports.checkMarketing = async (orgId) => {
  const org = await Organization.findById(orgId);
  if (!org) {
    throw new Error("Organization not found");
  }

  const aiConfig = await aiConfigService.getAIConfigByOrganizationId(orgId);

  return Boolean(
    org.hasMarketingEnabled &&
      aiConfig.markerting_agents &&
      aiConfig.markerting_agents.inbound &&
      aiConfig.markerting_agents.outbound &&
      aiConfig.markerting_agents.web
  );
};
