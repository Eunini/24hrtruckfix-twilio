const UserModel = require("../../user.model"); // Agents now live in here
const RoleModel = require("../../role.model");
const OrganizationModel = require("../../organization.model");
const {
  Types: { ObjectId },
} = require("mongoose");
const { sendInviteEmail } = require("../../../services/mail/approvalmail");
const bcryptjs = require("bcryptjs");
const { generateRandomPassword } = require("../../../helper");
const { default: mongoose } = require("mongoose");

exports.getAllAgents = async (
  userId,
  page = 1,
  limit = 10,
  search = "",
  sortField = "createdAt",
  sort = -1,
  orgId
) => {
  try {
    const currentUser = await UserModel.findById(userId).populate("role_id");
    if (!currentUser) {
      throw new Error(`User not found for ID: ${userId}`);
    }
    const userRoleName = currentUser.role_id?.name;
    if (!userRoleName) {
      throw new Error("Current user has no role assigned");
    }
    const isSuperOrAdmin = ["super_admin", "admin"].includes(userRoleName);
    let query = {};

    if (isSuperOrAdmin) {
      const excludedRoleNames = ["sub_agent", "sub_admin", "client"];
      const allowedRoles = await RoleModel.find({
        name: { $nin: excludedRoleNames },
      }).lean();
      const allowedRoleIds = allowedRoles.map((r) => r._id);
      if (allowedRoleIds.length === 0) {
        return {
          docs: [],
          totalDocs: 0,
          limit: Number(limit),
          page: Number(page),
          totalPages: 0,
          pagingCounter: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        };
      }
      query.role_id = { $in: allowedRoleIds };
    } else {
      let orgDoc = null;
      const ctxOrgId = orgId;
      if (ctxOrgId && ObjectId.isValid(ctxOrgId)) {
        orgDoc = await OrganizationModel.findById(ctxOrgId).lean();
        if (!orgDoc) {
          orgDoc = null; // fallback
        }
      }
      if (!orgDoc) {
        if (userRoleName === "client") {
          orgDoc = await OrganizationModel.findOne({
            owner: currentUser._id,
          }).lean();
        } else {
          orgDoc = await OrganizationModel.findOne({
            "members.user": currentUser._id,
          }).lean();
        }
      }
      if (!orgDoc) {
        // No organization found for this user
        return {
          docs: [],
          totalDocs: 0,
          limit: Number(limit),
          page: Number(page),
          totalPages: 0,
          pagingCounter: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        };
      }
      const memberIds = (orgDoc.members || [])
        .filter((m) => m.user)
        .map((m) => m.user.toString());
      const allIdsSet = new Set(memberIds);
      if (orgDoc.owner) {
        allIdsSet.add(orgDoc.owner.toString());
      }
      const allIds = Array.from(allIdsSet).map((idStr) => new ObjectId(idStr));
      if (allIds.length === 0) {
        return {
          docs: [],
          totalDocs: 0,
          limit: Number(limit),
          page: Number(page),
          totalPages: 0,
          pagingCounter: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        };
      }
      query._id = { $in: allIds };
    }

    if (query._id) {
      if (typeof query._id === "object") {
        query._id = {
          ...query._id,
          $ne: new ObjectId(userId),
        };
      } else {
        query._id = { $ne: new ObjectId(userId) };
      }
    } else {
      query._id = { $ne: new ObjectId(userId) };
    }

    if (search && String(search).trim()) {
      const terms = String(search)
        .trim()
        .split(/\s+/)
        .filter((t) => t);
      if (terms.length) {
        const orConditions = [];
        for (const term of terms) {
          if (ObjectId.isValid(term)) {
            orConditions.push({ _id: new ObjectId(term) }, {organizations: new ObjectId(term)});
          }
          [
            "role",
            "firstname",
            "lastname",
            "email",
            "phoneNumber",
            "companyName",
          ].forEach((field) => {
            const regex = new RegExp(term, "i");
            orConditions.push({ [field]: regex });
          });
        }
        query.$or = orConditions;
      }
    }

    const options = {
      page: Number(page),
      limit: Number(limit),
      sort: { [sortField]: Number(sort) },
      populate: [{ path: "role_id", select: "name" }],
      lean: true,
    };
    const userPage = await UserModel.paginate(query, options);
    const orgLookup = new Map();
    const returnedIds = userPage.docs.map((doc) => doc._id);

    if (userPage.docs.length) {
      if (isSuperOrAdmin) {
        const org = await OrganizationModel.find({
          $or: [
            { owner: { $in: returnedIds } },
            { "members.user": { $in: returnedIds } },
          ],
        });
        if (org.owner) {
          const oId = org.owner.toString();
          if (
            returnedIds.find((rid) => rid.toString() === oId) &&
            !orgLookup.has(oId)
          ) {
            orgLookup.set(oId, {
              _id: org._id,
              companyName: org.companyName || "Unnamed Organization",
              roleInOrg: "owner",
            });
          }
        }
        // Members
        for (const member of org.members || []) {
          if (member.user && member.status === "approved") {
            const uId = member.user.toString();
            if (
              returnedIds.find((rid) => rid.toString() === uId) &&
              !orgLookup.has(uId)
            ) {
              orgLookup.set(uId, {
                _id: org._id,
                companyName: org.companyName || "Unnamed Organization",
                status: member.status,
              });
            }
          }
        }
      }
    } else {
      let orgDoc = null;
      const ctxOrgId = orgId;
      if (ctxOrgId && ObjectId.isValid(ctxOrgId)) {
        orgDoc = await OrganizationModel.findById(ctxOrgId).lean();
      }
      if (!orgDoc) {
        if (userRoleName === "client") {
          orgDoc = await OrganizationModel.findOne({
            owner: currentUser._id,
          }).lean();
        } else {
          orgDoc = await OrganizationModel.findOne({
            "members.user": currentUser._id,
            // "members.status": "approved"
          }).lean();
        }
      }
      if (orgDoc) {
        const singleOrgInfo = {
          _id: orgDoc._id,
          companyName: orgDoc.companyName || "Unnamed Organization",
        };
        const memberStatusMap = new Map();
        for (const m of orgDoc.members || []) {
          if (m.user) {
            memberStatusMap.set(m.user.toString(), m.status);
          }
        }
        const ownerIdStr = orgDoc.owner?.toString();
        for (const uid of returnedIds) {
          const uidStr = uid.toString();
          if (uidStr === ownerIdStr) {
            orgLookup.set(uidStr, {
              ...singleOrgInfo,
              roleInOrg: "owner",
            });
          } else if (memberStatusMap.has(uidStr)) {
            orgLookup.set(uidStr, {
              ...singleOrgInfo,
              status: memberStatusMap.get(uidStr),
            });
          } else {
            orgLookup.set(uidStr, singleOrgInfo);
          }
        }
      }
    }

    userPage.docs = userPage.docs.map((userDoc) => {
      const { password, apiKey, __v, ...u } = userDoc;
      const orgInfo = orgLookup.get(u._id.toString()) || null;
      return {
        ...u,
        organization: orgInfo,
      };
    });

    return userPage;
  } catch (err) {
    console.error("Exception in getAllAgents:", err);
    throw err;
  }
};

exports.createNewAgent = async (agentData, createdBy) => {
  try {
    // Validate required fields
    const requiredFields = [
      "firstname",
      "lastname",
      "email",
      "phone",
      "role_id",
    ];
    for (const field of requiredFields) {
      if (!agentData[field]) throw new Error(`${field} is required`);
    }

    // Check for existing user with same email or phone
    const [existingEmail, existingPhone] = await Promise.all([
      UserModel.findOne({ email: agentData.email }),
      UserModel.findOne({ phoneNumber: agentData.phone }),
    ]);

    if (existingEmail) throw new Error("Email already exists");
    if (existingPhone) throw new Error("Phone number already exists");

    // Get creator user and their role
    const currentUser = await UserModel.findById(createdBy);
    if (!currentUser) throw new Error("Creator user not found");

    const currentUsersRole = await RoleModel.findById(currentUser.role_id);
    if (!currentUsersRole) throw new Error("Creator role not found");

    // Verify and set role for new agent
    const role = await RoleModel.findOne({ name: agentData.role_id });
    if (!role) throw new Error("Role not found");
    agentData.role_id = role._id;

    const username = agentData.email + Math.floor(Math.random() * 10000);
    // Generate secure password
    const rawPassword = generateRandomPassword(16);
    console.log(rawPassword);

    // Create new user document
    const newUser = new UserModel({
      ...agentData,
      password: rawPassword,
      username: username,
      phoneNumber: agentData.phone,
      createdBy: createdBy || null,
      createdByManual: true,
      isInvited: true,
      inVitedAt: new Date(),
      invitedBy: createdBy || null,
      status: "approved",
      organizations: agentData.organizations,
    });

    await newUser.save();

    // Handle organization membership
    const restrictedRoles = ["ai", "admin", "super_admin"];
    const clientRole = "client";
    const agentRoles = ["agent", "sub_admin"];

    if (!restrictedRoles.includes(currentUsersRole.name)) {
      let org;

      if (currentUsersRole.name === clientRole) {
        org = await OrganizationModel.findOne({ owner: createdBy });

        if (!org) {
          org = await OrganizationModel.create({
            owner: createdBy,
            members: [],
            isVerified: false,
            createdByManual: true,
          });
        }
      } else if (agentRoles.includes(currentUsersRole.name)) {
        org = await OrganizationModel.findOne({
          "members.user": createdBy,
          "members.status": "approved",
        });
      }

      if (org) {
        const alreadyMember = org.members.some(
          (m) => m.user.toString() === newUser._id.toString()
        );

        if (!alreadyMember) {
          org.members.push({
            user: newUser._id,
            addedBy: createdBy,
            joinedAt: new Date(),
            status: "approved",
          });

          await org.save();
        }
      }
    } else {
      if (
        Array.isArray(agentData.organizations) &&
        agentData.organizations.length > 0
      ) {
        for (const orgIdStr of agentData.organizations) {
          if (!mongoose.Types.ObjectId.isValid(orgIdStr)) {
            console.warn(`Invalid organization ID skipped: ${orgIdStr}`);
            continue;
          }
          const org = await OrganizationModel.findById(orgIdStr);
          if (!org) {
            console.warn(`Organization not found for ID: ${orgIdStr}`);
            continue;
          }
          // Check if newUser already in members
          const alreadyMember = org.members.some(
            (m) => m.user.toString() === newUser._id.toString()
          );
          if (!alreadyMember) {
            org.members.push({
              user: newUser._id,
              addedBy: createdBy,
              joinedAt: new Date(),
              status: "approved",
            });
            try {
              await org.save();
            } catch (err) {
              console.error(`Failed to add agent to org ${orgIdStr}:`, err);
            }
          }
        }
      }
    }

    const numberOfOrgs = Array.isArray(agentData?.organizations)
      ? agentData.organizations.length
      : 0;

      // console.log({numberOfOrgs})
    try {
      await sendInviteEmail({
        email: newUser.email,
        firstName: newUser.firstname,
        password: rawPassword,
        numberOfOrgs
      });
    } catch (error) {
      console.error("Exception in sendInviteEmail:", error);
    }

    const { password, ...userWithoutPassword } = newUser.toObject();
    return userWithoutPassword;
  } catch (error) {
    console.error("Exception in createNewAgent:", error);
    throw error;
  }
};

exports.getAgentDetailsById = async (agentId) => {
  try {
    const agent = await UserModel.findById(agentId)
      .populate("role_id")
      .populate("createdBy", "-password")
      .populate("invitedBy", "-password");

    if (!agent) {
      throw new Error("Agent not found");
    }

    const org = await OrganizationModel.findOne({
      "members.user": agentId,
    }).select("companyName _id owner members");

    const { password, ...agentWithoutPassword } = agent.toObject();
    return {
      ...agentWithoutPassword,
      organizations: org
        ? {
            _id: org._id,
            companyName: org.companyName,
            status: org.members.find((m) => m.user.toString() === agentId)
              ?.status,
          }
        : null,
    };
  } catch (error) {
    console.error("Exception in getAgentDetailsById:", error);
    throw error;
  }
};

exports.updateAgent = async (agentUpdates, agentId, createdBy) => {
  try {
    const existing = await UserModel.findById(agentId);
    if (!existing) throw new Error("Agent not found");

    // Check for duplicate email/phone if being updated
    if (agentUpdates.email && agentUpdates.email !== existing.email) {
      const emailExists = await UserModel.findOne({
        email: agentUpdates.email,
        _id: { $ne: agentId },
      });
      if (emailExists) throw new Error("Email already exists");
    }

    if (
      agentUpdates.phoneNumber &&
      agentUpdates.phoneNumber !== existing.phoneNumber
    ) {
      const phoneExists = await UserModel.findOne({
        phoneNumber: agentUpdates.phoneNumber,
        _id: { $ne: agentId },
      });
      if (phoneExists) throw new Error("Phone number already exists");
    }

    // Update role if provided
    if (agentUpdates.role) {
      const role = await RoleModel.findOne({ name: agentUpdates.role });
      if (!role) throw new Error("Role not found");
      agentUpdates.role = role._id;
    }

    // Update new list Org if provided
    if (Array.isArray(agentUpdates.organizations)) {
      const newOrgIds = agentUpdates.organizations.filter((orgIdStr) =>
        mongoose.Types.ObjectId.isValid(orgIdStr)
      );
      if (newOrgIds.length > 0) {
        const orgsWithAgent = await OrganizationModel.find({
          "members.user": agentId,
        });
        for (const org of orgsWithAgent) {
          const beforeCount = org.members.length;
          org.members = org.members.filter(
            (m) => m.user.toString() !== agentId.toString()
          );
          if (org.members.length !== beforeCount) {
            try {
              await org.save();
            } catch (err) {
              console.error(
                `Failed to remove agent ${agentId} from org ${org._id}:`,
                err
              );
            }
          }
        }
        for (const orgIdStr of newOrgIds) {
          const org = await OrganizationModel.findById(orgIdStr);
          if (!org) {
            console.warn(
              `Organization not found for ID: ${orgIdStr}, skipping`
            );
            continue;
          }
          const alreadyMember = org.members.some(
            (m) => m.user.toString() === agentId.toString()
          );
          if (!alreadyMember) {
            org.members.push({
              user: agentId,
              addedBy: createdBy,
              joinedAt: new Date(),
              status: "approved",
            });
            try {
              await org.save();
            } catch (err) {
              console.error(
                `Failed to add agent ${agentId} to org ${orgIdStr}:`,
                err
              );
            }
          }
        }
      }
    }

    // Update new list Org if provided
    if (Array.isArray(agentUpdates.organizations)) {
      const newOrgIds = agentUpdates.organizations.filter((orgIdStr) =>
        mongoose.Types.ObjectId.isValid(orgIdStr)
      );
      if (newOrgIds.length > 0) {
        const orgsWithAgent = await OrganizationModel.find({
          "members.user": agentId,
        });
        for (const org of orgsWithAgent) {
          const beforeCount = org.members.length;
          org.members = org.members.filter(
            (m) => m.user.toString() !== agentId.toString()
          );
          if (org.members.length !== beforeCount) {
            try {
              await org.save();
            } catch (err) {
              console.error(
                `Failed to remove agent ${agentId} from org ${org._id}:`,
                err
              );
            }
          }
        }
        for (const orgIdStr of newOrgIds) {
          const org = await OrganizationModel.findById(orgIdStr);
          if (!org) {
            console.warn(
              `Organization not found for ID: ${orgIdStr}, skipping`
            );
            continue;
          }
          const alreadyMember = org.members.some(
            (m) => m.user.toString() === agentId.toString()
          );
          if (!alreadyMember) {
            org.members.push({
              user: agentId,
              addedBy: createdBy,
              joinedAt: new Date(),
              status: "approved",
            });
            try {
              await org.save();
            } catch (err) {
              console.error(
                `Failed to add agent ${agentId} to org ${orgIdStr}:`,
                err
              );
            }
          }
        }
      }
    }

    // Update new list Org if provided
    if (Array.isArray(agentUpdates.organizations)) {
      const newOrgIds = agentUpdates.organizations.filter((orgIdStr) =>
        mongoose.Types.ObjectId.isValid(orgIdStr)
      );
      if (newOrgIds.length > 0) {
        const orgsWithAgent = await OrganizationModel.find({
          "members.user": agentId,
        });
        for (const org of orgsWithAgent) {
          const beforeCount = org.members.length;
          org.members = org.members.filter(
            (m) => m.user.toString() !== agentId.toString()
          );
          if (org.members.length !== beforeCount) {
            try {
              await org.save();
            } catch (err) {
              console.error(
                `Failed to remove agent ${agentId} from org ${org._id}:`,
                err
              );
            }
          }
        }
        for (const orgIdStr of newOrgIds) {
          const org = await OrganizationModel.findById(orgIdStr);
          if (!org) {
            console.warn(
              `Organization not found for ID: ${orgIdStr}, skipping`
            );
            continue;
          }
          const alreadyMember = org.members.some(
            (m) => m.user.toString() === agentId.toString()
          );
          if (!alreadyMember) {
            org.members.push({
              user: agentId,
              addedBy: createdBy,
              joinedAt: new Date(),
              status: "approved",
            });
            try {
              await org.save();
            } catch (err) {
              console.error(
                `Failed to add agent ${agentId} to org ${orgIdStr}:`,
                err
              );
            }
          }
        }
      }
    }

    const agentData = {
      firstname: agentUpdates.firstName,
      lastname: agentUpdates.lastName,
      email: agentUpdates.email,
      role_id: agentUpdates.role,
      phoneNumber: agentUpdates.phoneNumber,
      organizations: agentUpdates.organizations,
    };

    const updatedAgent = await UserModel.findByIdAndUpdate(
      agentId,
      { $set: agentData },
      { new: true }
    )
      .populate("role_id")
      .populate("createdBy", "-password")
      .populate("invitedBy", "-password");

    const { password, ...agentWithoutPassword } = updatedAgent.toObject();
    return agentWithoutPassword;
  } catch (error) {
    console.error("Exception in updateAgent:", error);
    throw error;
  }
};

exports.deleteAgentById = async (agentId, userId) => {
  try {
    // Remove from organizations first
    await OrganizationModel.updateMany(
      { "members.user": agentId },
      { $pull: { members: { user: agentId } } }
    );

    const user = await UserModel.findById(userId);
    const role = await RoleModel.findOne({ _id: user.role_id });
    const agentRole = role.name;
    if (!role && !agentRole) {
      throw new Error("Agent role not found");
    }

    if (agentRole === "sub_admin" || agentRole === "sub_agent") {
      throw new Error("This user not allowed to delete other agents");
    }

    const deletedAgent = await UserModel.findByIdAndDelete(agentId);
    if (!deletedAgent) {
      throw new Error("Agent not found");
    }

    const { password, ...agentWithoutPassword } = deletedAgent.toObject();
    return agentWithoutPassword;
  } catch (error) {
    console.error("Exception in deleteAgentById:", error);
    throw error;
  }
};

exports.disableAgent = async (agentId, status) => {
  try {
    const agent = await UserModel.findById(agentId).populate("role_id");
    if (!agent) throw new Error("Agent not found");

    if (
      !["agent", "sub_agent", "sub_admin", "admin"].includes(
        agent.role_id?.name
      )
    ) {
      throw new Error("User is not an agent or subagent");
    }

    // Update organization member status
    const org = await OrganizationModel.findOne({
      "members.user": agentId,
    });

    if (org) {
      const memberIndex = org.members.findIndex(
        (m) => m.user.toString() === agentId.toString()
      );

      if (memberIndex !== -1) {
        org.members[memberIndex].status = status;
        org.markModified("members");
        await org.save();
      }
    }

    // Update agent status
    agent.status = status;
    await agent.save();

    const { password, ...agentWithoutPassword } = agent.toObject();
    return {
      ...agentWithoutPassword,
      organization: org
        ? {
            _id: org._id,
            companyName: org.companyName,
            status,
          }
        : null,
    };
  } catch (error) {
    console.error("Exception in disableAgent:", error);
    throw error;
  }
};
