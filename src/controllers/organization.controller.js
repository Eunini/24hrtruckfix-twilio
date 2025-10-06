const organizationService = require("../services/organization.service");
const { HTTP_STATUS_CODES } = require("../helper");
const { Organization, User } = require("../models");
const { v4: uuidv4 } = require("uuid");

// Create a new organization
exports.createOrganization = async (req, res) => {
  try {
    const clientId = req.user.userId; // From auth middleware
    const result = await organizationService.createOrganization(
      req.body,
      clientId
    );
    res.status(HTTP_STATUS_CODES.CREATED).json(result);
  } catch (error) {
    console.error("createOrganization error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Create a new organization by admin
exports.createOrganByAdmin = async (req, res) => {
  try {
    const clientId = req.user.userId; // From auth middleware
    const result = await organizationService.createOrgByAdmin(
      req.body,
      clientId
    );
    res.status(HTTP_STATUS_CODES.CREATED).json(result);
  } catch (error) {
    console.error("createOrganization error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Get all organizations
exports.getOrganizations = async (req, res) => {
  try {
    const result = await organizationService.getAllOrganizations();
    res.status(HTTP_STATUS_CODES.OK).json(result);
  } catch (error) {
    console.error("getOrganizations error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Get single organization
exports.getSingleOrganization = async (req, res) => {
  try {
    const organization = await organizationService.getOrganizationById(
      req.params.id
    );
    if (!organization) {
      return res
        .status(HTTP_STATUS_CODES.NOT_FOUND)
        .json({ message: "Organization not found" });
    }
    res.status(HTTP_STATUS_CODES.OK).json(organization);
  } catch (error) {
    console.error("getSingleOrganization error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Get single organization with AI setup status
exports.getOrganizationWithAIStatus = async (req, res) => {
  try {
    const result = await organizationService.getOrganizationWithAIStatus(
      req.params.id
    );
    res.status(HTTP_STATUS_CODES.OK).json(result);
  } catch (error) {
    console.error("getOrganizationWithAIStatus error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Update organization
exports.updateOrganization = async (req, res) => {
  try {
    const result = await organizationService.updateOrganization(
      req.params.id,
      req.body
    );
    res.status(HTTP_STATUS_CODES.OK).json(result);
  } catch (error) {
    console.error("updateOrganization error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Upload organization image
exports.orgUploadImage = async (req, res) => {
  try {
    if (!req.files || !req.files.image) {
      return handleError(
        res,
        "No image file uploaded",
        HTTP_STATUS_CODES.BAD_REQUEST
      );
    }

    const username = req.user.userId;
    const file = req.files.image;
    const imgBuffer = file.data;
    const mimeType = file.mimetype;
    const result = await Organization.findOneAndUpdate(
      { owner: username },
      {
        $set: {
          logo: imgBuffer,
          logoContentType: mimeType,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(HTTP_STATUS_CODES.OK).json({
      message: "Profile image saved to MongoDB",
      data: result,
    });
  } catch (error) {
    console.error("upload error:", error);
    return res
      .status(HTTP_STATUS_CODES.BAD_REQUEST)
      .json({ message: error.message });
  }
};

// get image
exports.getOrgImage = async (req, res) => {
  try {
    const username = req.user.userId;
    const org = await Organization.findOne({ owner: username }).select(
      "logo logoContentType"
    );
    if (!org || !org.logo) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).send("Logo not found");
    }

    res.set("Content-Type", org.logoContentType);
    return res.send(org.logo);
  } catch (err) {
    console.error("fetch logo error:", err);
    return res
      .status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
      .json({ message: err.message });
  }
};

// Delete organization
exports.deleteOrganization = async (req, res) => {
  try {
    const result = await organizationService.deleteOrganizationById(
      req.params.id
    );
    res.status(HTTP_STATUS_CODES.NO_CONTENT).json(result);
  } catch (error) {
    console.error("deleteOrganization error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Add member to organization
exports.addMemberToOrganization = async (req, res) => {
  try {
    const { userId, role } = req.body;
    const result = await organizationService.addMemberToOrganization(
      req.params.id,
      userId,
      role
    );
    res.status(HTTP_STATUS_CODES.OK).json(result);
  } catch (error) {
    console.error("addMemberToOrganization error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Remove member from organization
exports.removeMemberFromOrganization = async (req, res) => {
  try {
    const result = await organizationService.removeMemberFromOrganization(
      req.params.id,
      req.params.userId
    );
    res.status(HTTP_STATUS_CODES.OK).json(result);
  } catch (error) {
    console.error("removeMemberFromOrganization error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Get organization by owner ID
exports.getOrgByOwnerId = async (req, res) => {
  try {
    const result = await organizationService.getOrganizationsByOwnerId(
      req.params.ownerId
    );
    res.status(HTTP_STATUS_CODES.OK).json(result);
  } catch (error) {
    console.error("getOrgByOwnerId error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Get organization by policy num
exports.getOrgByPolicy = async (req, res) => {
  try {
    const result = await organizationService.getOrganizationsByPolicy(
      req.params.policy
    );
    res.status(HTTP_STATUS_CODES.OK).json(result);
  } catch (error) {
    console.error("getOrgByOwnerId error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

exports.getOrgDriver = async (req, res) => {
  console.log(req.params, req.body);
  const { orgId } = req.params;
  try {
    const result = await organizationService.getSettingsByOrgId(orgId);
    res.status(HTTP_STATUS_CODES.OK).json(result);
  } catch (error) {
    console.error("getOrgDriver error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

exports.updateOrgDriver = async (req, res) => {
  console.log(req.params, req.body);
  const { orgId } = req.params;
  const driverData = req.body;
  try {
    const result = await organizationService.updateSettingsByOrgId(
      orgId,
      driverData
    );
    res.status(HTTP_STATUS_CODES.OK).json(result);
  } catch (error) {
    console.error("getOrgDriver error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

exports.setUpDriverPortal = async (req, res) => {
  const { orgId } = req.params;
  const data = req.body;
  try {
    const result = await organizationService.setUpDriverPortal(orgId, data);
    console.log(result);
    res.status(HTTP_STATUS_CODES.OK).json(result);
  } catch (error) {
    console.error("setUpDriverPortal error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

exports.verifyOrganizationUrlSlug = async (req, res) => {
  const { urlSlug } = req.params;
  try {
    const result = await organizationService.verifyOrganizationUrlSlug(urlSlug);
    res.status(HTTP_STATUS_CODES.OK).json(result);
  } catch (error) {
    console.error("verifyOrganizationUrlSlug error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

exports.getOrgDriverReferralPath = async (req, res) => {
  const { urlPath } = req.params;
  try {
    const result = await organizationService.resolveReferralPath(urlPath);
    res.status(HTTP_STATUS_CODES.OK).json(result);
  } catch (error) {
    console.error("getOrgDriver error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

exports.updateOrgDriverReferralPath = async (req, res) => {
  const { orgId } = req.params;
  const urlPath = req.body;
  try {
    const result = await organizationService.updateReferralPath(orgId, urlPath);
    res.status(HTTP_STATUS_CODES.OK).json(result);
  } catch (error) {
    console.error("getOrgDriver error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

/**
 * Verify organization and automatically setup AI configuration
 * @route POST /api/organizations/:id/verify
 */
exports.verifyOrganization = async (req, res) => {
  try {
    const { status, countryCode, areaCode } = req.body;

    if (!status) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: "Status is required",
      });
    }

    const result = await organizationService.verifyOrganization(
      req.params.id,
      status,
      {
        countryCode,
        areaCode,
      }
    );

    // Determine response based on AI setup result
    let responseMessage = "Organization verification completed";
    let responseData = {
      organization: result.organization,
      aiSetup: result.aiSetup,
    };

    if (result.aiSetup) {
      if (result.aiSetup.success) {
        responseMessage =
          "Organization verified and AI setup completed successfully";
      } else {
        responseMessage = "Organization verified but AI setup failed";
      }
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: responseMessage,
      data: responseData,
    });
  } catch (error) {
    console.error("verifyOrganization error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Retry AI setup for an organization
 * @route POST /api/organizations/:id/retry-ai-setup
 */
exports.retryAISetup = async (req, res) => {
  try {
    const { countryCode, areaCode } = req.body;

    const result = await organizationService.retryAISetup(req.params.id, {
      countryCode,
      areaCode,
    });

    const responseMessage = result.aiSetup.success
      ? "AI setup retry completed successfully"
      : "AI setup retry failed";

    res.status(HTTP_STATUS_CODES.OK).json({
      success: result.aiSetup.success,
      message: responseMessage,
      data: result,
    });
  } catch (error) {
    console.error("retryAISetup error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Cleanup AI configuration for an organization
 * @route DELETE /api/organizations/:id/ai-setup
 */
exports.cleanupAISetup = async (req, res) => {
  try {
    const result = await organizationService.cleanupAISetup(req.params.id);

    const responseMessage = result.cleanup.success
      ? "AI setup cleanup completed successfully"
      : "AI setup cleanup failed";

    res.status(HTTP_STATUS_CODES.OK).json({
      success: result.cleanup.success,
      message: responseMessage,
      data: result,
    });
  } catch (error) {
    console.error("cleanupAISetup error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Set policy upsert mode for an organization
 * @route PUT /api/organizations/:id/upsert-policies
 */
exports.setShouldUpsertPolicies = async (req, res) => {
  try {
    const { shouldUpsert } = req.body;

    if (typeof shouldUpsert !== "boolean") {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: "shouldUpsert must be a boolean value",
      });
    }

    const result = await organizationService.setShouldUpsertPolicies(
      req.params.id,
      shouldUpsert
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      message: `Policy upsert mode ${
        shouldUpsert ? "enabled" : "disabled"
      } successfully`,
      organization: result,
      shouldUpsertPolicies: result.shouldUpsertPolicies,
    });
  } catch (error) {
    console.error("setShouldUpsertPolicies error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

/**
 * Get policy upsert mode for an organization
 * @route GET /api/organizations/:id/upsert-policies
 */
exports.getShouldUpsertPolicies = async (req, res) => {
  try {
    const shouldUpsert = await organizationService.getShouldUpsertPolicies(
      req.params.id
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      organizationId: req.params.id,
      shouldUpsertPolicies: shouldUpsert,
      message: `Policy upsert mode is ${shouldUpsert ? "enabled" : "disabled"}`,
    });
  } catch (error) {
    console.error("getShouldUpsertPolicies error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

/**
 * Bulk set policy upsert mode for multiple organizations
 * @route PUT /api/organizations/bulk/upsert-policies
 */
exports.bulkSetShouldUpsertPolicies = async (req, res) => {
  try {
    const { organizationIds, shouldUpsert } = req.body;

    if (!Array.isArray(organizationIds) || organizationIds.length === 0) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: "organizationIds must be a non-empty array",
      });
    }

    if (typeof shouldUpsert !== "boolean") {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: "shouldUpsert must be a boolean value",
      });
    }

    const result = await organizationService.bulkSetShouldUpsertPolicies(
      organizationIds,
      shouldUpsert
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      message: `Policy upsert mode ${
        shouldUpsert ? "enabled" : "disabled"
      } for ${result.modifiedCount} organizations`,
      result,
    });
  } catch (error) {
    console.error("bulkSetShouldUpsertPolicies error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

exports.enableMarketing = async (req, res) => {
  const { orgId } = req.params;
  const { hasMarketingEnabled = true, areaCode = "302" } = req.body;
  try {
    const result = await organizationService.enableMarketing(
      orgId,
      hasMarketingEnabled,
      areaCode
    );
    res.status(HTTP_STATUS_CODES.OK).json(result);
  } catch (error) {
    console.error("enableMarketing error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

exports.checkMarketing = async (req, res) => {
  const { orgId } = req.params;
  try {
    const result = await organizationService.checkMarketing(orgId);
    res.status(HTTP_STATUS_CODES.OK).json({ isEnabled: result });
  } catch (error) {
    console.error("checkMarketing error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};
