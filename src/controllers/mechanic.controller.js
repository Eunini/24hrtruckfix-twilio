require("dotenv").config();
const { default: mongoose } = require("mongoose");
const {
  getAllMechanics,
  createNewMechanic,
  getMechanicDetailsById,
  updateMechanic,
  updateIsAccepted,
  deleteMechanicById,
  getAllMechanicsBasedOnOrganization,
  toggleBlacklistMechanic,
  bulkDeleteMechanics,
  bulkUploadMechanics,
  getMechanicBlacklistOrgs,
  unblacklistMechanicGlobally,
  blacklistMechanicGlobally,
  unblacklistMechanicForOrg,
} = require("../models/mongo/functions/mechanic");

const {
  getMechanicPermissions,
  haversineDistanceMeters,
} = require("../utils/orgHelpers");

const {
  addMechanicsBulkUploadJob,
  getJobStatus,
  QUEUE_NAMES,
} = require("../services/queue/queueManager");
const { Mechanic, Organization, Ticket } = require("../models");
const { geocodeAddress } = require("../utils/geocode");

/**
 * Get all mechanics with pagination and search
 */
exports.getAllMechanicsController = async (req, res) => {
  try {
    const {
      page,
      limit = 10,
      search = "",
      sortField = "createdAt",
      sort = -1,
      blacklist = true,
    } = req.query;

    console.log(req.query);

    // Only use the user's organization ID
    const organization_id = req.user.organizationId;
    const role = req.user.adminRole;

    if (!organization_id && !["admin", "super_admin"].includes(role)) {
      return res.status(401).json({
        success: false,
        error: "User must belong to an organization",
      });
    }

    const filterBlacklist = blacklist === "true";

    const mechanics = await getAllMechanics(
      parseInt(page),
      parseInt(limit),
      search,
      sortField,
      parseInt(sort),
      organization_id,
      role,
      filterBlacklist
    );

    res.status(200).json({
      success: true,
      data: mechanics,
    });
  } catch (error) {
    console.error("Error in getAllMechanicsController:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
};

exports.getCombinedMechanicsController = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      sortField = "createdAt",
      sort = -1,
      blacklist = true,
    } = req.query;

    // parse values safely
    const pageNum = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
    const limitNum = parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 10;
    const sortDir = parseInt(sort, 10) === 1 ? 1 : -1;
    const sortOpt = { [sortField || "createdAt"]: sortDir };

    // ensure blacklist is boolean (query params are strings)
    if (typeof blacklist === "string") {
      blacklist = blacklist === "true";
    } else {
      blacklist = Boolean(blacklist);
    }

    const userId = req.user && req.user.userId;
    const role = req.user && req.user.adminRole;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User must be authenticated",
      });
    }

    // helper: escape regex special characters
    const escapeRegex = (str) =>
      String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Find org ids to filter by
    let orgFilterIds = [];

    if (role === "agent") {
      const orgDocs = await Organization.find({
        $or: [
          { owner: new mongoose.Types.ObjectId(userId) },
          { "members.user": new mongoose.Types.ObjectId(userId) },
        ],
      })
        .select("_id")
        .lean();

      orgFilterIds = orgDocs
        .map((d) => d._id)
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      if (orgFilterIds.length === 0) {
        // no orgs for agent -> return empty page
        const emptyPage = {
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
        };
        return res.status(200).json({ success: true, data: emptyPage });
      }
    } else {
      // Non-agent: single org from user
      const singleOrgId = req.user && req.user.organizationId;
      if (!singleOrgId || !mongoose.Types.ObjectId.isValid(singleOrgId)) {
        return res.status(401).json({
          success: false,
          error: "User must belong to an organization",
        });
      }
      orgFilterIds = [new mongoose.Types.ObjectId(singleOrgId)];
    }

    // base query (mechanics belonging to these orgs)
    const query = {
      organization_id: { $in: orgFilterIds },
    };

    // Exclude mechanics that are blacklisted by any of these orgs if blacklist === true
    if (blacklist) {
      // $nor with an $elemMatch that matches any blacklisted entry whose organization_id is in orgFilterIds
      query.$nor = [
        {
          blacklisted: {
            $elemMatch: {
              organization_id: { $in: orgFilterIds },
            },
          },
        },
      ];
    }

    // Build search conditions
    const searchStr = typeof search === "string" ? search.trim() : "";

    if (searchStr) {
      const safe = escapeRegex(searchStr);
      const textRegex = new RegExp(safe, "i");

      // If there are digits in the search, build a permissive digits regex that allows separators
      const digitsOnly = searchStr.replace(/\D/g, "");
      let phoneRegex = null;
      if (digitsOnly.length >= 1) {
        // e.g. "4341" -> /4\D*3\D*4\D*1/  (matches 4-341, +4 341, etc.)
        const pattern = digitsOnly
          .split("")
          .map((d) => escapeRegex(d))
          .join("\\D*");
        phoneRegex = new RegExp(pattern, "i");
      }

      // Note: specialty can be an array or a string. Use both approaches for safety.
      const specialtyArrayElem = {
        specialty: { $elemMatch: { $regex: textRegex } },
      };
      const specialtyString = { specialty: { $regex: textRegex } };

      // build the $or conditions for many possible fields
      const orClauses = [
        { email: { $regex: textRegex } },
        { firstName: { $regex: textRegex } },
        { lastName: { $regex: textRegex } },
        { companyName: { $regex: textRegex } },
        { office_num: { $regex: textRegex } },
        { address: { $regex: textRegex } },
        { city: { $regex: textRegex } },
        { state: { $regex: textRegex } },
        { country: { $regex: textRegex } },
        specialtyArrayElem,
        specialtyString,
      ];

      // phones: check several phone fields with either the textRegex or phoneRegex (if digits provided)
      const phoneFields = [
        "mobileNumber",
        "phoneNumber",
        "office_num",
        "mobile",
        "phone",
      ];
      phoneFields.forEach((field) => {
        if (phoneRegex) {
          orClauses.push({ [field]: { $regex: phoneRegex } });
        }
        orClauses.push({ [field]: { $regex: textRegex } });
      });

      // Also attempt to match full name tokens separately (so searching "Benjamin Texas" will match either)
      const tokens = searchStr.split(/\s+/).filter(Boolean);
      tokens.forEach((t) => {
        const rt = new RegExp(escapeRegex(t), "i");
        orClauses.push({ firstName: { $regex: rt } });
        orClauses.push({ lastName: { $regex: rt } });
        orClauses.push({ companyName: { $regex: rt } });
        orClauses.push({ city: { $regex: rt } });
        orClauses.push({ state: { $regex: rt } });
      });

      query.$or = orClauses;
    }

    // Build pagination options
    const options = {
      page: pageNum,
      limit: limitNum,
      sort: sortOpt,
      populate: [{ path: "organization_id", select: "companyName" }],
      lean: true,
    };

    const mechanicsPage = await Mechanic.paginate(query, options);

    return res.status(200).json({ success: true, data: mechanicsPage });
  } catch (err) {
    console.error("Error in getCombinedMechanicsController:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Internal Server Error",
    });
  }
};

/**
 * Create a new mechanic
 */
exports.createMechanicController = async (req, res) => {
  try {
    const { adminRole } = req.user || {};
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: "User must belong to an organization",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User authentication required",
      });
    }

    const newMechanic = await createNewMechanic(
      req.body,
      adminRole,
      userId,
      organizationId
    );

    res.status(201).json({
      success: true,
      data: newMechanic,
    });
  } catch (error) {
    console.error("Error in createMechanicController:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get selected mechanic details by ID
 */
exports.getSelectedMechanicByIdController = async (req, res) => {
  try {
    const mechanic_id = req.params.mechanic;
    if (!mechanic_id) {
      return res.status(400).json({
        success: false,
        error: "Mechanic ID is required",
      });
    }

    const mechanic = await getMechanicDetailsById(mechanic_id);
    if (!mechanic) {
      return res.status(404).json({
        success: false,
        error: "Mechanic not found",
      });
    }

    res.status(200).json({
      success: true,
      data: mechanic,
    });
  } catch (error) {
    console.error("Error in getMechanicByIdController:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
};

/**
 * Get mechanic details by ID
 */
exports.getMechanicByIdController = async (req, res) => {
  try {
    // Handle both 'mechanics' and 'id' parameter names for compatibility
    const mechanic_id = req.params.mechanics || req.params.id;
    const userOrganizationId = req.user.organizationId;

    if (!mechanic_id) {
      return res.status(400).json({
        success: false,
        error: "Mechanic ID is required",
      });
    }

    if (!userOrganizationId) {
      return res.status(401).json({
        success: false,
        error: "User must belong to an organization",
      });
    }

    const mechanic = await getMechanicDetailsById(mechanic_id);

    if (!mechanic) {
      return res.status(404).json({
        success: false,
        error: "Mechanic not found",
      });
    }

    // Check if the mechanic belongs to the user's organization
    const belongsToOrg = Array.isArray(mechanic.organization_id)
      ? mechanic.organization_id.some(
          (orgId) => orgId.toString() === userOrganizationId.toString()
        )
      : mechanic.organization_id &&
        mechanic.organization_id.toString() === userOrganizationId.toString();

    if (!belongsToOrg) {
      return res.status(403).json({
        success: false,
        error: "Access denied: Mechanic does not belong to your organization",
      });
    }

    res.status(200).json({
      success: true,
      data: mechanic,
    });
  } catch (error) {
    console.error("Error in getMechanicByIdController:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
};

/**
 * Update mechanic details
 */
exports.updateMechanicController = async (req, res) => {
  try {
    const mechanic_id = req.params.id;
    const userOrganizationId = req.user.organizationId || "";
    const role = req.user.adminRole;

    if (!mechanic_id) {
      return res.status(400).json({
        success: false,
        error: "Mechanic ID is required",
      });
    }

    if (!userOrganizationId && role !== "super_admin" && role !== "admin") {
      return res.status(401).json({
        success: false,
        error: "User must belong to an organization",
      });
    }

    // First check if the mechanic exists and belongs to the user's organization
    const existingMechanic = await getMechanicDetailsById(mechanic_id);
    if (!existingMechanic) {
      return res.status(404).json({
        success: false,
        error: "Mechanic not found",
      });
    }

    const belongsToOrg = Array.isArray(existingMechanic.organization_id)
      ? existingMechanic.organization_id.some(
          (org) =>
            (org?._id ? org._id.toString() : org.toString()) ===
            userOrganizationId.toString()
        )
      : existingMechanic.organization_id &&
        existingMechanic.organization_id.toString() ===
          userOrganizationId.toString();

    if (!belongsToOrg && role !== "super_admin" && role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Access denied: Mechanic does not belong to your organization",
      });
    }

    // Remove organization_id from update data to prevent changing it
    const updateData = { ...req.body };
    delete updateData.organization_id;

    const updatedMechanic = await updateMechanic(updateData, mechanic_id);

    if (!updatedMechanic) {
      return res.status(404).json({
        success: false,
        error: "Mechanic not found",
      });
    }

    res.status(200).json({
      success: true,
      data: updatedMechanic,
    });
  } catch (error) {
    console.error("Error in updateMechanicController:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Update mechanic acceptance status
 */
exports.updateIsAcceptedController = async (req, res) => {
  try {
    const mechanic_id = req.params.id;
    const userOrganizationId = req.user.organizationId;

    if (!mechanic_id) {
      return res.status(400).json({
        success: false,
        error: "Mechanic ID is required",
      });
    }

    if (!userOrganizationId) {
      return res.status(401).json({
        success: false,
        error: "User must belong to an organization",
      });
    }

    // Check if the mechanic belongs to the user's organization
    const existingMechanic = await getMechanicDetailsById(mechanic_id);
    if (!existingMechanic) {
      return res.status(404).json({
        success: false,
        error: "Mechanic not found",
      });
    }

    const belongsToOrg = Array.isArray(existingMechanic.organization_id)
      ? existingMechanic.organization_id.some(
          (org) =>
            (org?._id ? org._id.toString() : org.toString()) ===
            userOrganizationId.toString()
        )
      : existingMechanic.organization_id &&
        existingMechanic.organization_id.toString() ===
          userOrganizationId.toString();

    if (!belongsToOrg) {
      return res.status(403).json({
        success: false,
        error: "Access denied: Mechanic does not belong to your organization",
      });
    }

    const result = await updateIsAccepted(req.body, mechanic_id);

    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Error in updateIsAcceptedController:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
};

/**
 * Delete mechanic by ID
 */
exports.deleteMechanicController = async (req, res) => {
  try {
    const mechanic_id = req.params.id;
    const userOrganizationId = req.user.organizationId;
    const role = req.user.adminRole;

    if (!mechanic_id) {
      return res.status(400).json({
        success: false,
        error: "Mechanic ID is required",
      });
    }

    if (!userOrganizationId && role !== "super_admin" && role !== "admin") {
      return res.status(401).json({
        success: false,
        error: "User must belong to an organization",
      });
    }

    // Check if the mechanic belongs to the user's organization
    const existingMechanic = await getMechanicDetailsById(mechanic_id);
    if (!existingMechanic) {
      return res.status(404).json({
        success: false,
        error: "Mechanic not found",
      });
    }

    const isPrivileged = role === "super_admin" || role === "admin";
    const userOrgIdStr = userOrganizationId?.toString();
    let belongsToOrg = false;

    if (Array.isArray(existingMechanic.organization_id)) {
      belongsToOrg = existingMechanic.organization_id.some(
        (org) =>
          (org?._id ? org._id.toString() : org.toString()) === userOrgIdStr
      );
    } else if (existingMechanic.organization_id) {
      belongsToOrg =
        (existingMechanic.organization_id._id
          ? existingMechanic.organization_id._id.toString()
          : existingMechanic.organization_id.toString()) === userOrgIdStr;
    }

    if (!isPrivileged && !belongsToOrg) {
      return res.status(403).json({
        success: false,
        error: "Access denied: Mechanic does not belong to your organization",
      });
    }

    const result = await deleteMechanicById(mechanic_id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Mechanic not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Mechanic deleted successfully",
    });
  } catch (error) {
    console.error("Error in deleteMechanicController:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
};

/**
 * Get all mechanics based on organization
 */
exports.getAllMechanicsBasedOnOrganizationController = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortField = "createdAt",
      sort = -1,
      offset = 0,
    } = req.query;

    // Only use the user's organization ID
    const organization_id = req.user.organizationId;

    if (!organization_id) {
      return res.status(401).json({
        success: false,
        error: "User must belong to an organization",
      });
    }

    // Convert offset to page if provided
    const actualPage = offset
      ? Math.floor(parseInt(offset) / parseInt(limit)) + 1
      : parseInt(page);

    const mechanics = await getAllMechanicsBasedOnOrganization(
      actualPage,
      parseInt(limit),
      search,
      sortField,
      parseInt(sort),
      organization_id
    );

    res.status(200).json({
      success: true,
      data: mechanics,
    });
  } catch (error) {
    console.error(
      "Error in getAllMechanicsBasedOnOrganizationController:",
      error
    );
    res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
};

/**
 * Toggle blacklist status for a mechanic
 */
exports.toggleBlacklistMechanicController = async (req, res) => {
  try {
    const mechanic_id = req.params.id;
    const { reason } = req.body;
    const userOrganizationId = req.user.organizationId;
    const admin = req.user.adminRole;
    const admins = admin === "admin" || admin === "super_admin";

    if (!mechanic_id) {
      return res.status(400).json({
        success: false,
        error: "Mechanic ID is required",
      });
    }

    console.log({ userOrganizationId });
    if (!userOrganizationId && !admins) {
      return res.status(401).json({
        success: false,
        error: "User must belong to an organization",
      });
    }

    // Check if the mechanic exists (no need to check organization ownership for blacklisting)
    const existingMechanic = await getMechanicDetailsById(mechanic_id);
    if (!existingMechanic) {
      return res.status(404).json({
        success: false,
        error: "Mechanic not found",
      });
    }

    const result = await toggleBlacklistMechanic(
      mechanic_id,
      userOrganizationId,
      reason
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in toggleBlacklistMechanicController:", error);
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET blacklisted mechanics
 */
exports.getMechanicBlacklistOrgsController = async (req, res) => {
  try {
    const mechanicId = req.params.id;
    const userOrganizationId = req.user.organizationId;
    const role = req.user.adminRole;
    const isPrivileged = role === "admin" || role === "super_admin";

    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        error: "Access denied: only admins and super admins can view this",
      });
    }

    const result = await getMechanicBlacklistOrgs(
      mechanicId,
      userOrganizationId,
      role
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("Error in getMechanicBlacklistOrgsController:", err);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error:
        status === 404
          ? "Mechanic not found"
          : "Server error fetching blacklist entries",
    });
  }
};

/**
 * Blacklist a mechanic across all organizations.
 */
exports.blacklistMechanicGloballyController = async (req, res) => {
  try {
    const mechanicId = req.params.id;
    const { reason } = req.body;
    const role = req.user.adminRole;
    const isPrivileged = role === "admin" || role === "super_admin";

    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        error:
          "Access denied: only admins and super admins can do a global blacklist",
      });
    }

    const updated = await blacklistMechanicGlobally(mechanicId, reason);
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, error: err.message });
  }
};

/**
 * Remove a mechanic from the blacklist for a specific organization.
 */
exports.unblacklistMechanicForOrgController = async (req, res) => {
  try {
    const mechanicId = req.params.id;
    const orgId = req.params.orgId;
    const userRole = req.user.adminRole;
    const isPrivileged = userRole === "admin" || userRole === "super_admin";

    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        error:
          "Access denied: insufficient permissions to remove blacklist tag for this mechanic",
      });
    }

    const updatedMechanic = await unblacklistMechanicForOrg(mechanicId, orgId);
    return res.status(200).json({ success: true, data: updatedMechanic });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, error: err.message });
  }
};

/**
 * Unblacklist a mechanic from all organizations.
 */
exports.unblacklistMechanicGloballyController = async (req, res) => {
  console.log({ req }, req.user, req.params);
  try {
    const mechanicId = req.params.id;
    const role = req.user.adminRole;
    const isPrivileged = role === "admin" || role === "super_admin";

    if (!isPrivileged) {
      return res.status(403).json({
        success: false,
        error:
          "Access denied: only admins and super admins can do a global unblacklist",
      });
    }

    const updated = await unblacklistMechanicGlobally(mechanicId);
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, error: err.message });
  }
};

/**
 * Bulk delete mechanics
 */
exports.bulkDeleteMechanicsController = async (req, res) => {
  try {
    // Handle both 'mechanicIds' and 'ids' for compatibility
    const mechanicIds = req.body.mechanicIds || req.body.ids;
    const userOrganizationId = req.user.organizationId;
    const role = req.user.adminRole;
    const isPrivileged = role === "super_admin" || role === "admin";

    if (!Array.isArray(mechanicIds) || mechanicIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid or empty mechanic IDs array",
      });
    }

    if (!userOrganizationId && !isPrivileged) {
      return res.status(401).json({
        success: false,
        error: "User must belong to an organization",
      });
    }

    const userOrgIdStr = userOrganizationId?.toString() || null;
    const mechanicsToDelete = [];
    const unauthorizedMechanics = [];
    for (const id of mechanicIds) {
      try {
        const mechanic = await getMechanicDetailsById(id);
        if (!mechanic) {
          unauthorizedMechanics.push({ id, error: "Not found" });
          continue;
        }

        const rawOrg = mechanic.organization_id;
        const mechOrgId = rawOrg ? (rawOrg._id ? rawOrg._id : rawOrg) : null;

        const mechOrgIdStr = mechOrgId?.toString() || null;
        if (!isPrivileged && mechOrgIdStr && mechOrgIdStr !== userOrgIdStr) {
          unauthorizedMechanics.push({
            id,
            error: "Access denied: Does not belong to your organization",
          });
          continue;
        }
        mechanicsToDelete.push(id);
      } catch (error) {
        unauthorizedMechanics.push({ id, error: error.message });
      }
    }

    if (mechanicsToDelete.length === 0) {
      return res.status(403).json({
        success: false,
        error: "No mechanics found that belong to your organization",
        unauthorized: unauthorizedMechanics,
      });
    }

    const result = await bulkDeleteMechanics(mechanicsToDelete);

    // Add unauthorized mechanics to the failed list
    result.failedItems = [
      ...(result.failedItems || []),
      ...unauthorizedMechanics,
    ];
    result.failed = result.failedItems.length;

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in bulkDeleteMechanicsController:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Internal Server Error",
    });
  }
};

/**
 * Bulk upload mechanics (using background queue)
 */
exports.bulkUploadMechanicsController = async (req, res) => {
  try {
    // Handle both array directly or nested in 'mechanics' property
    const mechanics = Array.isArray(req.body) ? req.body : req.body.mechanics;
    const { adminRole } = req.user || {};
    const userId = req.user.userId;
    const organizationId = req.user.organizationId;

    if (!Array.isArray(mechanics) || mechanics.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid or empty mechanics array",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User authentication required",
      });
    }

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: "User must belong to an organization",
      });
    }

    // Prepare job data with user context
    const jobData = {
      data: mechanics,
      user: {
        userId,
        email: req.user.email,
        adminRole,
        organizationId,
        organizationRole: req.user.organizationRole,
      },
      organizationId,
      adminRole,
      userId,
      requestedAt: new Date(),
      requestMetadata: {
        userAgent: req.headers["user-agent"],
        ip: req.ip,
        totalRecords: mechanics.length,
      },
    };

    // Add job to Redis queue
    const job = await addMechanicsBulkUploadJob(jobData);

    res.status(202).json({
      success: true,
      message: "Bulk upload job queued successfully",
      data: {
        jobId: job.id,
        queueName: QUEUE_NAMES.BULK_UPLOAD_MECHANICS,
        status: "queued",
        totalRecords: mechanics.length,
        estimatedProcessingTime: `${Math.ceil(mechanics.length / 100)} minutes`,
        statusCheckUrl: `/api/v1/jobs/${QUEUE_NAMES.BULK_UPLOAD_MECHANICS}/${job.id}/status`,
      },
    });
  } catch (error) {
    console.error("Error in bulkUploadMechanicsController:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to queue bulk upload job",
    });
  }
};

/**
 * Get job status
 */
exports.getJobStatusController = async (req, res) => {
  try {
    const { queueName, jobId } = req.params;
    const userOrganizationId = req.user.organizationId;

    if (!userOrganizationId) {
      return res.status(401).json({
        success: false,
        error: "User must belong to an organization",
      });
    }

    const jobStatus = await getJobStatus(queueName, jobId);

    if (jobStatus.status === "not_found") {
      return res.status(404).json({
        success: false,
        error: "Job not found",
      });
    }

    // Security check: ensure user can only see jobs from their organization
    if (
      jobStatus.data &&
      jobStatus.data.organizationId !== userOrganizationId.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied: Job does not belong to your organization",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        jobId: jobStatus.id,
        status: jobStatus.status,
        progress: jobStatus.progress,
        result: jobStatus.result,
        error: jobStatus.failedReason,
        createdAt: jobStatus.createdAt,
        processedAt: jobStatus.processedOn,
        completedAt: jobStatus.finishedOn,
        queueName,
      },
    });
  } catch (error) {
    console.error("Error in getJobStatusController:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get job status",
    });
  }
};

exports.suggestMechanics = async (req, res) => {
  try {
    const lng = req.body.coord.longitude;
    const lat = req.body.coord.latitude;
    const isAdmin =
      req.user.adminRole === "super_admin" || req.user.adminRole === "admin";
    const userOrgId = req.user.organizationId;
    if (!userOrgId) {
      return res
        .status(400)
        .json({ message: "User organization context required" });
    }

    const org = await Organization.findById(userOrgId).lean();
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const perms = org.permissions || {};
    const { primaryMechanic, secondaryMechanic, allMechanics } = perms;
    const baseQuery = {};
    if (primaryMechanic && !secondaryMechanic && !allMechanics) {
      baseQuery.organization_id =
        { $in: [mongoose.Types.ObjectId(userOrgId)] } ||
        mongoose.Types.ObjectId(userOrgId);
      baseQuery.blacklisted = {
        $not: {
          $elemMatch: {
            organization_id: mongoose.Types.ObjectId(userOrgId),
          },
        },
      };
    }

    if (secondaryMechanic && allMechanics && isAdmin) {
      baseQuery.blacklisted = {
        $not: {
          $elemMatch: {
            organization_id: mongoose.Types.ObjectId(userOrgId),
          },
        },
      };
    }

    const miles = parseFloat(process.env.MECHANIC_MILES) || 50;
    const meters = parseFloat(process.env.METERS_PER_MILE) || 1609.34;
    const maxDistanceMeters = miles * meters;

    // Primary geo query using $nearSphere
    const geoFilter = {
      mechanicLocation: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: maxDistanceMeters,
        },
      },
    };

    let suggestions = await Mechanic.find({ ...baseQuery, ...geoFilter })
      .limit(5)
      .lean();

    // Fill in additional mechanics if fewer than 5
    const needed = 5 - suggestions.length;
    if (needed > 0) {
      const candidates = await Mechanic.find({
        ...baseQuery,
        $or: [
          { mechanicLocation: { $exists: false } },
          { "mechanicLocation.coordinates": { $size: 0 } },
          { mechanicLocationLatitude: { $in: [null, "", undefined] } },
          { mechanicLocationLongitude: { $in: [null, "", undefined] } },
        ],
      })
        .limit(10)
        .lean();

      for (const mech of candidates) {
        const parts = [];
        if (mech.address) parts.push(mech.address);
        if (mech.city) parts.push(mech.city);
        if (mech.state) parts.push(mech.state);
        if (mech.zipcode) parts.push(mech.zipcode);

        const addressString = parts.join(", ");
        if (!addressString) continue;

        try {
          const coordObj = await geocodeAddress(addressString);
          if (!coordObj) continue;

          const latM = parseFloat(coordObj.latitude);
          const lngM = parseFloat(coordObj.longitude);

          await Mechanic.findByIdAndUpdate(mech._id, {
            mechanicLocation: { type: "Point", coordinates: [lngM, latM] },
            mechanicLocationLatitude: coordObj.latitude,
            mechanicLocationLongitude: coordObj.longitude,
          });

          const distMeters = haversineDistanceMeters(lat, lng, latM, lngM);
          if (distMeters <= maxDistanceMeters) {
            suggestions.push({
              ...mech,
              mechanicLocation: { type: "Point", coordinates: [lngM, latM] },
              mechanicLocationLatitude: coordObj.latitude,
              mechanicLocationLongitude: coordObj.longitude,
            });
            if (suggestions.length >= 5) break;
          }
        } catch (err) {
          console.error(`Error geocoding mechanic ${mech._id}:`, err);
        }
      }
    }

    suggestions = suggestions.slice(0, 5);
    if (!suggestions.length) {
      return res.json({
        success: true,
        data: [],
        message: "No mechanics found within 50 miles",
      });
    }

    return res.json({ success: true, data: suggestions });
  } catch (err) {
    console.error("Error in suggestMechanics:", err);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * Filter/search mechanics with pagination, obeying org mechanic settings.
 * GET /api/v1/mechanics?page=1&limit=10&search=...&sortField=firstName&sortOrder=1
 */
exports.filterMechanics = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      sortField = "createdAt",
      sortOrder = "-1",
      blacklist = true,
    } = req.query;
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    const sortDir = parseInt(sortOrder, 10) === 1 ? 1 : -1;
    const isAdmin =
      req.user.adminRole === "super_admin" || req.user.adminRole === "admin";
    let perms;
    let orgId;
    // Validate sortField if desired
    const validSortFields = ["createdAt", "firstName", "lastName", "email"];
    if (!validSortFields.includes(sortField)) {
      sortField = "createdAt";
    }

    if (!isAdmin) {
      orgId = req.user.organizationId || req.user.organization._id;
      if (!orgId) {
        return res
          .status(400)
          .json({ message: "Organization context not found" });
      }
      try {
        perms = await getMechanicPermissions(orgId);
      } catch (err) {
        return res.status(404).json({ message: err.message });
      }
    }

    const query = {};
    if (isAdmin) {
    } else if (perms.primaryMechanic) {
      // only SPs assigned to this org
      query.organization_id =
        { $in: [new mongoose.Types.ObjectId(userOrgId)] } ||
        new mongoose.Types.ObjectId(orgId);

      if (blacklist) {
        query.blacklisted = {
          $not: {
            $elemMatch: {
              organization_id: new mongoose.Types.ObjectId(orgId),
            },
          },
        };
      }
    } else if (perms.secondaryMechanic || perms.allMechanics) {
      if (blacklist) {
        query.blacklisted = {
          $not: {
            $elemMatch: {
              organization_id: new mongoose.Types.ObjectId(orgId),
            },
          },
        };
      }
    } else {
      // return empty paginated result
      const emptyResult = {
        docs: [],
        totalDocs: 0,
        limit,
        page,
        totalPages: 0,
        pagingCounter: 0,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
      };
      return res.json({ success: true, data: emptyResult });
    }

    if (typeof search === "string" && search.trim()) {
      const terms = search
        .trim()
        .split(/\s+/)
        .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      query.$or = terms.flatMap((term) => {
        const regex = new RegExp(term, "i");
        const conds = [
          { firstName: { $regex: regex } },
          { lastName: { $regex: regex } },
          { companyName: { $regex: regex } },
          { email: { $regex: regex } },
          { city: { $regex: regex } },
        ];
        if (mongoose.Types.ObjectId.isValid(term)) {
          conds.push({ _id: new mongoose.Types.ObjectId(term) });
        }
        return conds;
      });
    }

    const options = {
      page,
      limit,
      sort: { [sortField]: sortDir },
      populate: [{ path: "firstName", select: "companyName" }],
      lean: true,
    };
    const mechanicsPage = await Mechanic.paginate(query, options);
    return res.json({ success: true, data: mechanicsPage });
  } catch (err) {
    console.error("Error in filterMechanics:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Find Providers on Google Maps
exports.findGoogleMapsProviders = async (req, res) => {
  try {
    const { address, serviceType, radius = 10 } = req.body;
    const userId = req.user.userId;

    // Validate input
    if (!address) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields",
          details: [
            {
              field: "address",
              message: "Address is required",
            },
          ],
        },
      });
    }

    // Get user's organization
    // const userOrg = await Organization.findOne({
    //   $or: [{ owner: userId }, { "members.user": userId }],
    // });

    // if (!userOrg) {
    //   return res.status(404).json({
    //     success: false,
    //     error: {
    //       code: "NOT_FOUND",
    //       message: "User organization not found",
    //     },
    //   });
    // }

    // Geocode the address to get coordinates for distance calculation
    const { geocodeAddress } = require("../utils/geocode");
    const coordinates = await geocodeAddress(address);

    let searchOptions = {};
    if (coordinates) {
      searchOptions = {
        latitude: parseFloat(coordinates.latitude),
        longitude: parseFloat(coordinates.longitude),
        radius: parseFloat(radius),
      };
    }

    // Build search query
    const serviceQuery = serviceType
      ? `${serviceType} `
      : "towing roadside assistance ";
    const fullQuery = `${serviceQuery}near ${address}`;

    // Search Google Places
    const { searchPlaces } = require("../services/googlePlaces.service");
    const providers = await searchPlaces(
      fullQuery,
      process.env.GOOGLE_PLACES_API_KEY,
      searchOptions
    );

    res.status(200).json({
      success: true,
      message: `Found ${providers.length} providers on Google Maps`,
      data: providers,
      searchCriteria: {
        address,
        serviceType: serviceType || "Towing, Roadside Assistance",
        radius,
      },
    });
  } catch (error) {
    console.error("Error in findGoogleMapsProviders:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
    });
  }
};

// Create Provider from Google Maps
exports.createProviderFromGoogleMaps = async (req, res) => {
  try {
    const { googleProvider, ticketId } = req.body;
    const userId = req.user.userId;

    // Validate input
    if (!googleProvider) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields",
          details: [
            {
              field: "googleProvider",
              message: "Google provider data is required",
            },
          ],
        },
      });
    }

    if (!googleProvider.name || !googleProvider.address) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields",
          details: [
            {
              field: "googleProvider.name",
              message: "Provider name is required",
            },
            {
              field: "googleProvider.address",
              message: "Provider address is required",
            },
          ],
        },
      });
    }

    // Get user's organization
    const userOrg = await Organization.findOne({
      $or: [{ owner: userId }, { "members.user": userId }],
    });

    if (!userOrg) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "User organization not found",
        },
      });
    }

    // Check if ticketId is provided and valid
    let ticket = null;
    if (ticketId) {
      if (!mongoose.Types.ObjectId.isValid(ticketId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid ticket ID",
          },
        });
      }

      ticket = await Ticket.findOne({
        _id: ticketId,
      });

      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "Ticket not found or unauthorized",
          },
        });
      }
    }

    // Parse address components
    const addressParts = googleProvider.address
      .split(",")
      .map((part) => part.trim());
    const lastPart = addressParts[addressParts.length - 1];
    const secondLastPart = addressParts[addressParts.length - 2];

    // Try to extract state and zipcode
    let state = "";
    let zipcode = "";
    let city = "";

    if (lastPart && /^\d{5}(-\d{4})?$/.test(lastPart)) {
      zipcode = lastPart;
      if (secondLastPart) {
        const stateMatch = secondLastPart.match(/\b([A-Z]{2})\b/);
        if (stateMatch) {
          state = stateMatch[1];
          city = secondLastPart.replace(stateMatch[0], "").trim();
        } else {
          city = secondLastPart;
        }
      }
    } else if (lastPart) {
      const zipMatch = lastPart.match(/\b(\d{5}(-\d{4})?)\b/);
      const stateMatch = lastPart.match(/\b([A-Z]{2})\b/);

      if (zipMatch) zipcode = zipMatch[1];
      if (stateMatch) state = stateMatch[1];

      if (secondLastPart) {
        city = secondLastPart;
      }
    }

    // If we still don't have city, try to get it from earlier parts
    if (!city && addressParts.length > 1) {
      city =
        addressParts[addressParts.length - (zipcode || state ? 2 : 1)] || "";
    }

    // Create mechanic from Google provider data
    const mechanicData = {
      firstName: "Google Maps",
      lastName: "Provider",
      businessName: googleProvider.name,
      companyName: googleProvider.name,
      email: `contact@${googleProvider.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")}.com`,
      phoneNumber: googleProvider.phoneNumber || "",
      mobileNumber: googleProvider.phoneNumber || "",
      address: googleProvider.address,
      city: city,
      state: state,
      zipcode: zipcode,
      googlePlaceId: googleProvider.placeId || "",
      googleRating: googleProvider.rating || 0,
      source: "google_maps",
      isAccepted: true,
      stripe: false,
      organization_id: [userOrg._id] || userOrg._id,
      client_id: [userId],
      createdByManual: false,
    };

    // Geocode the address for location data
    const { geocodeAddress } = require("../utils/geocode");
    const coordinates = await geocodeAddress(googleProvider.address);

    if (coordinates) {
      mechanicData.mechanicLocation = {
        type: "Point",
        coordinates: [
          parseFloat(coordinates.longitude),
          parseFloat(coordinates.latitude),
        ],
      };
      mechanicData.mechanicLocationLatitude = coordinates.latitude;
      mechanicData.mechanicLocationLongitude = coordinates.longitude;
    }

    // Create the mechanic
    const newMechanic = await Mechanic.create(mechanicData);

    // Assign to ticket if provided
    let assignment = null;
    if (ticket) {
      await Ticket.findByIdAndUpdate(ticketId, {
        assigned_subcontractor: newMechanic._id,
        status: "assigned",
        auto_assigned_at: new Date(),
        auto_assigned_by: userId.toString(),
      });

      assignment = {
        ticketId: ticketId,
        providerId: newMechanic._id.toString(),
        assignedAt: new Date(),
        assignedBy: userId,
        status: "assigned",
      };
    }

    const responseData = {
      provider: {
        _id: newMechanic._id,
        firstName: newMechanic.firstName,
        lastName: newMechanic.lastName,
        email: newMechanic.email,
        businessName: newMechanic.businessName,
        phoneNumber: newMechanic.phoneNumber,
        mobileNumber: newMechanic.mobileNumber,
        address: newMechanic.address,
        googlePlaceId: newMechanic.googlePlaceId,
        googleRating: newMechanic.googleRating,
        source: newMechanic.source,
        isAccepted: newMechanic.isAccepted,
        stripe: newMechanic.stripe,
        createdAt: newMechanic.createdAt,
        updatedAt: newMechanic.updatedAt,
      },
    };

    if (assignment) {
      responseData.assignment = assignment;
    }

    res.status(201).json({
      success: true,
      message: assignment
        ? "Service provider created from Google Maps and assigned to ticket"
        : "Service provider created from Google Maps",
      data: responseData,
    });
  } catch (error) {
    console.error("Error in createProviderFromGoogleMaps:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
    });
  }
};
