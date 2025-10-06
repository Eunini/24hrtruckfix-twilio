const {
  Types: { ObjectId },
} = require("mongoose");
const MechanicModel = require("../../../models/mechanic.model");
const { sendApprovalEmail } = require("../../../services/mail/approvalmail");
const { geocodeAddress } = require("../../../utils/geocode");
const organizationModel = require("../../organization.model");

// Define searchable fields to avoid repetition and ease maintenance
const searchableFields = [
  "firstName",
  "lastName",
  "email",
  "businessName",
  "tags",
  "specialty",
  "city",
  "state",
  "country",
  "address",
  "companyName",
  "mobileNumber",
  "phoneNumber",
  "office_num"

];

// Utility to escape regex special characters for safe querying
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


exports.getAllMechanics = async (
  page,
  limit = 10,
  search = "",
  sortField = "createdAt",
  sort = -1,
  organization_id = "",
  role = "",
  blacklist = true
) => {
  page = Number(page);
  limit = Number(limit);
  if (page < 1 || limit < 1) {
    throw new Error("Page and limit must be positive integers");
  }

  const validSortFields = ["createdAt", "firstName", "email", "lastName"];
  sortField = String(sortField).trim();
  if (!validSortFields.includes(sortField)) {
    throw new Error("Invalid sort field");
  }

  // normalize blacklist param (could be string from query)
  if (typeof blacklist === "string") {
    blacklist = blacklist === "true";
  } else {
    blacklist = Boolean(blacklist);
  }

  const isElevated = role === "admin" || role === "super_admin";
  const query = {};

  // organization scoping for non-elevated users
  if (!isElevated) {
    if (organization_id) {
      // convert to ObjectId when possible
      if (ObjectId.isValid(organization_id)) {
        query.organization_id = { $in: [new ObjectId(organization_id)] } || new ObjectId(organization_id);
      } else {
        // invalid org id -> no results
        return {
          docs: [],
          totalDocs: 0,
          limit,
          totalPages: 0,
          page,
          pagingCounter: 0,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        };
      }

      if (blacklist) {
        // exclude mechanics that have a blacklisted entry for this organization
        query.$nor = [
          {
            blacklisted: {
              $elemMatch: {
                organization_id: new ObjectId(organization_id),
              },
            },
          },
        ];
      }
    } else {
      // return empty page if no org specified
      return {
        docs: [],
        totalDocs: 0,
        limit,
        totalPages: 0,
        page,
        pagingCounter: 0,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
      };
    }
  }

  // Build search query when provided
  const trimmed = String(search || "").trim();
  if (trimmed) {
    const tokens = trimmed.split(/\s+/).filter(Boolean);

    // For each token we will create an array of OR conditions and then $or will be the combination
    const orForAllTokens = [];

    tokens.forEach((rawToken) => {
      const token = rawToken; // keep raw for ObjectId checks / digit extraction
      const esc = escapeRegex(token);
      const textRegex = new RegExp(esc, "i");

      const tokenConds = [];

      // If token looks like an ObjectId, allow _id exact match
      if (ObjectId.isValid(token)) {
        try {
          tokenConds.push({ _id: new ObjectId(token) });
        } catch (e) {
          // ignore if cast fails
        }
      }

      // Try phone-like permissive regex when token contains digits
      const digitsOnly = token.replace(/\D/g, "");
      if (digitsOnly.length >= 1) {
        // build pattern like: 4\D*3\D*4\D*1 to match numbers with separators
        const phonePattern = digitsOnly.split("").map((d) => escapeRegex(d)).join("\\D*");
        tokenConds.push({ mobileNumber: { $regex: phonePattern, $options: "i" } });
        tokenConds.push({ phoneNumber: { $regex: phonePattern, $options: "i" } });
        tokenConds.push({ office_num: { $regex: phonePattern, $options: "i" } });
      }

      // Add regex conditions for all searchable fields
      searchableFields.forEach((field) => {
        // If field is specialty (often an array), include both array elemMatch and string-match variants
        if (field === "specialty") {
          tokenConds.push({ specialty: { $elemMatch: { $regex: textRegex } } });
          tokenConds.push({ specialty: { $regex: textRegex } });
        } else {
          tokenConds.push({ [field]: { $regex: textRegex } });
        }
      });

      // boolean shortcuts
      if (token.toLowerCase() === "enabled") {
        tokenConds.push({ stripe: true });
      } else if (token.toLowerCase() === "disabled") {
        tokenConds.push({ stripe: false });
      }

      // Date token (YYYY-MM-DD or other parseable date) -> match conversion_date on that day
      const d = new Date(token);
      if (!isNaN(d.getTime())) {
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);
        tokenConds.push({
          conversion_date: { $gte: dayStart, $lt: dayEnd },
        });
      }

      // also split token into sub-tokens (for phrases like "Unbroken Home", tokens are already split)
      // push the tokenConds group to the top-level or array
      if (tokenConds.length > 0) {
        orForAllTokens.push({ $or: tokenConds });
      }
    });

    // If we created OR groups, attach them to query.
    // Using $and with groups ensures that each token must match at least one field (AND semantics across tokens),
    // which is usually desired for multi-term searches. If you want OR across tokens, use $or.
    if (orForAllTokens.length > 0) {
      query.$and = orForAllTokens;
    }
  }

  const options = {
    page,
    limit,
    sort: { [sortField]: Number(sort) },
    populate: [
      {
        path: "organization_id",
        select: "companyName keyBillingContactEmail",
      },
    ],
    lean: true,
  };

  try {
    const mechanicsPage = await MechanicModel.paginate(query, options);
    return mechanicsPage;
  } catch (err) {
    console.error("Error fetching mechanics:", err);
    throw new Error("Failed to fetch mechanics");
  }
};

exports.createNewMechanic = async (mechanic, adminRole, userId, organizationId) => {
  let newMechanic = null;
  try {
    const requiredFields = ['firstName', 'lastName', 'email', 'mobileNumber'];
    for (const field of requiredFields) {
      if (!mechanic[field]) {
        throw new Error(`${field} is required`);
      }
    }

    const existingMechanicByEmail = await MechanicModel.findOne({
      email: mechanic.email,
    });
    if (existingMechanicByEmail) {
      throw new Error("Email already exists");
    }

    const existingMechanicByMobile = await MechanicModel.findOne({
      mobileNumber: mechanic.mobileNumber,
    });
    if (existingMechanicByMobile) {
      throw new Error("Mobile number already exists");
    }

    const parts = [];
    if (mechanic.streetAddress) {parts.push(mechanic.streetAddress)}
    else if (mechanic.address) {parts.push(mechanic.address);}
    if (mechanic.city) parts.push(mechanic.city);
    if (mechanic.state) parts.push(mechanic.state);
    if (mechanic.country) parts.push(mechanic.country);
    if (mechanic.zipcode) parts.push(mechanic.zipcode);

    const addressString = parts.join(", ");
    if (addressString) {

      const coord = await geocodeAddress(addressString);
      if (coord) {
        mechanic.mechanicLocation = {
          type: "Point",
          coordinates: [parseFloat(coord.longitude), parseFloat(coord.latitude)]
        };
        
        mechanic.mechanicLocationLatitude = coord.latitude;
        mechanic.mechanicLocationLongitude = coord.longitude;
      } else {
        console.warn("Geocoding failed for new mechanic address:", addressString);
        throw new Error("Unable to geocode mechanic address");
      }
    }

    const orgId = Array.isArray(organizationId) ? organizationId : [organizationId]
    mechanic.isAccepted = adminRole === "admin" || adminRole === "super_admin";
    newMechanic = await MechanicModel.create({
      ...mechanic,
      client_id: [userId],
      organization_id: orgId,
      createdByManual: true,
    });

    return newMechanic;
  } catch (ex) {
    console.error("Exception in createNewMechanic:", ex);
    throw ex;
  }
};

exports.getMechanicDetailsById = async (mechanic_id) => {
  try {
    const mechanic = await MechanicModel.findById(mechanic_id)
      .populate('organization_id', 'companyName businessName keyBillingContactEmail');
    return mechanic;
  } catch (ex) {
    console.error("Exception in getMechanicDetailsById:", ex);
    throw ex;
  }
};

exports.updateMechanic = async (mechanic, mechanic_id) => {
  try {
    const getMechanic = await MechanicModel.findById(mechanic_id);

    if (!getMechanic) {
      throw new Error("Mechanic not found");
    }

    if (
      mechanic.mobileNumber &&
      mechanic.mobileNumber !== getMechanic.mobileNumber
    ) {
      const existingMechanic = await MechanicModel.findOne({
        mobileNumber: mechanic.mobileNumber,
      });
      if (existingMechanic && existingMechanic._id.toString() !== mechanic_id) {
        throw new Error("Mobile number already exists");
      }
    }
    

      // Check if any address changed
  const addressFields = ["streetAddress", "city", "state", "zipcode"];
  let shouldReGeocode = false;
  const parts = [];

  for (const field of addressFields) {
    if (field in mechanic) {
      shouldReGeocode = true;
    }
  }
  if (shouldReGeocode) {
    // Build new address string from updated or existing fields
    for (const field of addressFields) {
      if (field in mechanic) {
        if (mechanic[field]) parts.push(mechanic[field]);
      } 
      // else if (existingMechanic[field]) {
      //   parts.push(existingMechanic[field]);
      // }
    }
    const addressString = parts.join(", ");
    if (addressString) {
      const coord = await geocodeAddress(addressString);
      if (coord) {
        mechanic.mechanicLocation = {
          type: "Point",
          coordinates: [parseFloat(coord.longitude), parseFloat(coord.latitude)]
        };
        mechanic.mechanicLocationLatitude = coord.latitude;
        mechanic.mechanicLocationLongitude = coord.longitude;
      } else {
        console.warn("Geocoding failed for updated mechanic address:", addressString);
      }
    }
  }

    const updatedMechanic = await MechanicModel.findByIdAndUpdate(
      mechanic_id,
      mechanic,
      { new: true }
    ).populate('organization_id', 'companyName keyBillingContactEmail');

    return updatedMechanic;
  } catch (ex) {
    console.error("Exception in updateMechanic:", ex);
    throw ex;
  }
};

exports.updateIsAccepted = async (mechanic, mechanic_id) => {
  try {
    const updatedMechanic = await MechanicModel.findByIdAndUpdate(
      mechanic_id,
      { isAccepted: mechanic.isAccepted },
      { new: true }
    ).populate('organization_id', 'companyName keyBillingContactEmail');

    if (!updatedMechanic) {
      return {
        statusCode: 404,
        body: { error: "Mechanic not found" },
      };
    }

    // Send approval email using the mail service
    await sendApprovalEmail(updatedMechanic.email, updatedMechanic.firstName);

    return {
      statusCode: 200,
      body: updatedMechanic,
    };
  } catch (ex) {
    console.error("Exception in updateIsAccepted:", ex);
    return {
      statusCode: 500,
      body: { error: ex.message },
    };
  }
};

exports.deleteMechanicById = async (mechanic_id) => {
  try {
    const result = await MechanicModel.findByIdAndDelete(mechanic_id);
    if (!result) {
      throw new Error("Mechanic not found");
    }
    return result;
  } catch (ex) {
    console.error("Exception in deleteMechanicById:", ex);
    throw ex;
  }
};

exports.getAllMechanicsBasedOnOrganization = async (
  page = 1,
  limit = 10,
  search = "",
  sortField = "createdAt",
  sort = -1,
  organization_id
) => {
  const query = {
    firstName: { $exists: true, $ne: "" },
    organization_id: { $in: [organization_id] } || organization_id,
    "blacklisted.organization_id": { $ne: organization_id },
  };

  if (search.trim() !== "") {
    const searchTerms = search
      .split(" ")
      .filter((term) => term.trim().length > 0);

    query.$or = searchTerms.flatMap((term) => {
      const conditions = [];

      if (ObjectId.isValid(term)) {
        conditions.push({ _id: ObjectId(term) });
      }

      searchableFields.forEach((field) => {
        conditions.push({ [field]: { $regex: term, $options: "i" } });
      });

      if (term.toLowerCase() === "enabled") {
        conditions.push({ stripe: true });
      } else if (term.toLowerCase() === "disabled") {
        conditions.push({ stripe: false });
      }

      const parsedDate = new Date(term);
      if (!isNaN(parsedDate.getTime())) {
        conditions.push({
          conversion_date: {
            $gte: new Date(parsedDate.setHours(0, 0, 0, 0)),
            $lt: new Date(parsedDate.setHours(23, 59, 59, 999)),
          },
        });
      }

      return conditions;
    });
  }

  const options = {
    page,
    limit,
    sort: { [sortField]: Number(sort) },
    populate: [
      { path: 'organization_id', select: 'companyName keyBillingContactEmail' }
    ]
  };

  try {
    const mechanics = await MechanicModel.paginate(query, options);
    return mechanics;
  } catch (ex) {
    console.error("Exception in getAllMechanicsBasedOnOrganization:", ex);
    throw ex;
  }
};

exports.toggleBlacklistMechanic = async (mechanic_id, organization_id, reason) => {
  try {
    const mechanic = await MechanicModel.findById(mechanic_id);

    if (!mechanic) {
      throw new Error("Mechanic not found");
    }

    mechanic.blacklisted = mechanic.blacklisted || [];
    const existingEntryIndex = mechanic.blacklisted.findIndex(
      (entry) => entry.organization_id && entry.organization_id.toString() === organization_id.toString()
    );

    if (existingEntryIndex !== -1) {
      mechanic.blacklisted.splice(existingEntryIndex, 1);
      console.log("Organization removed the mechanic from their blacklist");
    } else {
      mechanic.blacklisted.push({ organization_id, reason });
      console.log("Mechanic has been blacklisted by the organization");
    }

    await mechanic.save();
    return mechanic;
  } catch (error) {
    console.error("Exception in toggleBlacklistMechanic:", error);
    throw error;
  }
};

exports.getMechanicBlacklistOrgs = async (
  mechanicId,
  userOrganizationId,
  role
) => {
  const isSuper = role === "super_admin" || role === "_admin";
  const mech = await MechanicModel.findById(mechanicId)
    .select("name blacklisted")
    .lean();

  if (!mech) {
    const err = new Error("Mechanic not found");
    err.status = 404;
    throw err;
  }

  const entries = mech.blacklisted.filter((entry) =>
    isSuper
      ? true
      : entry.organization_id.toString() === userOrganizationId.toString()
  );

  const organizations = entries.map((entry) => ({
    organization_id: entry.organization_id,
    reason: entry.reason,
    blacklistedAt: entry.createdAt || entry.updatedAt || null,
  }));

  return {
    ...mech,
    organizations,
  };
};

exports.unblacklistMechanicGlobally = async (mechanicId) => {
  const mech = await MechanicModel.findById(mechanicId);
  if (!mech) throw Object.assign(new Error('Mechanic not found'), { status: 404 });

  mech.blacklisted = [];

  await mech.save();
  return mech;
};

exports.blacklistMechanicGlobally = async (mechanicId, reason) => {
  const mech = await MechanicModel.findById(mechanicId);
  if (!mech) throw Object.assign(new Error('Mechanic not found'), { status: 404 });

  const allOrgs = await organizationModel.find({}, '_id').lean();
  const orgIds = allOrgs.map(o => o._id.toString());
    mech.blacklisted = mech.blacklisted || [];
  const existing = new Set(
    mech.blacklisted.map(e => e.organization_id.toString())
  );

  for (const orgId of orgIds) {
    if (!existing.has(orgId)) {
      mech.blacklisted.push({ organization_id: orgId, reason: "Admin blacklisted this mechnaic" });
    }
  }

  await mech.save();
  return mech;
};

exports.bulkDeleteMechanics = async (mechanicIds) => {
  try {
    if (!Array.isArray(mechanicIds) || mechanicIds.length === 0) {
      throw new Error("No mechanic IDs provided");
    }

    let successCount = 0;
    let failed = [];
    let deletedIds = [];

    for (const id of mechanicIds) {
      try {
        const result = await MechanicModel.findByIdAndDelete(id);
        if (result) {
          deletedIds.push(id);
          successCount++;
        } else {
          failed.push({ id, error: "Not found" });
        }
      } catch (err) {
        failed.push({ id, error: err.message });
      }
    }

    return {
      message: "Bulk delete completed",
      deletedIds,
      deleted: successCount,
      failed: failed.length,
      failedItems: failed,
    };
  } catch (error) {
    console.error("Exception in bulkDeleteMechanics:", error);
    throw error;
  }
};

exports.unblacklistMechanicForOrg = async (mechanicId, orgId) => {
  const mech = await MechanicModel.findById(mechanicId);
  if (!mech) {
    const err = new Error('Mechanic not found');
    err.status = 404;
    throw err;
  }

  // If there's no blacklisted array, nothing to do
  if (!Array.isArray(mech.blacklisted) || mech.blacklisted.length === 0) {
    return mech;
  }

  // Filter out that organization
  mech.blacklisted = mech.blacklisted.filter(
    (entry) => entry.organization_id.toString() !== orgId
  );

  await mech.save();
  return mech;
};

exports.bulkUploadMechanics = async (mechanicsData, adminRole, userId, organizationId) => {
  try {
    if (!mechanicsData || mechanicsData.length === 0) {
      throw new Error("No mechanic data provided");
    }

    const orgId = Array.isArray(organizationId) ? organizationId : [organizationId];

    // ✅ Remove duplicates within the uploaded file (by email or phone)
    const seen = new Set();
    const uniqueData = mechanicsData.filter((item) => {
      const key = (item.primaryEmail || "").toLowerCase() + "|" + (item.officeNumber || "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ✅ Cross check with DB for existing mechanics (email or phone)
    const emails = uniqueData.map((i) => i.primaryEmail).filter(Boolean);
    const phones = uniqueData.map((i) => i.officeNumber).filter(Boolean);

    const existingMechanics = await MechanicModel.find({
      $or: [
        { email: { $in: emails } },
        { mobileNumber: { $in: phones } }
      ]
    });

    const existingByEmail = new Map(existingMechanics.map(m => [m.email?.toLowerCase(), m]));
    const existingByPhone = new Map(existingMechanics.map(m => [m.mobileNumber, m]));

    const toInsert = [];
    const toUpdate = [];

    const transformedMechanicsData = uniqueData.map((item) => {
      const {
        primaryEmail,
        secondaryEmail,
        firstName,
        officeNumber,
        companyName,
        ...rest
      } = item;

      const existing =
        (primaryEmail && existingByEmail.get(primaryEmail.toLowerCase())) ||
        (officeNumber && existingByPhone.get(officeNumber));

      if (existing) {
        // ✅ Mechanic already exists → merge org assignment
        const newOrgIds = new Set([
          ...existing.organization_id.map((id) => id.toString()),
          ...orgId.map((id) => id.toString())
        ]);
        existing.organization_id = Array.from(newOrgIds);
        toUpdate.push(existing.save());
        return null; // skip adding to insert
      }

      // ✅ New mechanic to be inserted
      return {
        ...rest,
        ...(firstName && { firstName }),
        ...(primaryEmail && { email: primaryEmail }),
        ...(companyName && { companyName }),
        ...(secondaryEmail && { email_2: secondaryEmail }),
        ...(officeNumber && { mobileNumber: officeNumber }),
        client_id: [userId],
        organization_id: orgId,
        createdByManual: true,
        isAccepted: ["admin", "super_admin"].includes(adminRole),
      };
    }).filter(Boolean);

    if (transformedMechanicsData.length > 0) {
      const inserted = await MechanicModel.insertMany(transformedMechanicsData, { ordered: false });
      return {
        message: "Bulk upload completed",
        uploaded: inserted,
        updated: toUpdate.length,
        count: inserted.length + toUpdate.length
      };
    } else {
      await Promise.all(toUpdate);
      return {
        message: "Bulk upload completed (all were existing, orgs updated)",
        uploaded: [],
        updated: toUpdate.length,
        count: toUpdate.length
      };
    }

  } catch (error) {
    console.error("Exception in bulkUploadMechanics:", error);
    throw error;
  }
};