const UserModel = require("../models/users"); // User model for handling members
const { getMongoConnection } = require("../../../loaders/mongo/connect");
const {
  Types: { ObjectId },
} = require("mongoose");
const OrganizationModel = require("../models/organization");
const { default: axios } = require("axios");

// Create a new organization
exports.createOrganization = async (organizationData, clientId, orgType) => {
  try {
    await getMongoConnection();

    const requiredFields = ["clientId", "orgType"];
    for (const field of requiredFields) {
      if (!organizationData[field]) throw new Error(`${field} is required`);
    }

    const { clientId } = organizationData;
    // Check if clientId is valid
    const client = await UserModel.findById(clientId);
    if (!client) throw new Error("Client not found");

    // Check if organization already exists by ownerId
    const existingOrganization = await OrganizationModel.findOne({
      owner: clientId,
    });

    if (existingOrganization)
      throw new Error("Organization with this name already exists");

    // console.log({clientId})
    const newOrganization = await OrganizationModel.create({
      owner: clientId,
      createdByManual: true,
      organization_type: orgType,
    });

    return newOrganization;
  } catch (ex) {
    console.error("❌ exception createOrganization", ex);
    throw ex;
  }
};

exports.getAllOrganizations = async () => {
  try {
    await getMongoConnection();

    const organizations = await OrganizationModel.find({})
      .populate("owner", "-password") // Optional: Show owner info
      .populate("members.user", "-password"); // Optional: Show member info

    return organizations;
  } catch (ex) {
    console.error("❌ exception getAllOrganizations", ex);
    throw ex;
  }
};

// Get organization details by ID
exports.getOrganizationById = async (orgId) => {
  try {
    await getMongoConnection();
    return await OrganizationModel.findById(orgId)
      .populate("members.userId") // Populate member user details
      .exec();
  } catch (ex) {
    console.error("❌ exception getOrganizationById", ex);
    return null;
  }
};

// Update organization details
exports.updateOrganization = async (orgId, organizationData) => {
  try {
    await getMongoConnection();
    const organization = await OrganizationModel.findById(orgId);
    if (!organization) throw new Error("Organization not found");

    // Update only allowed fields
    Object.assign(organization, organizationData);

    await organization.save();
    return organization;
  } catch (ex) {
    console.error("❌ exception updateOrganization", ex);
    throw ex;
  }
};

// Delete organization by ID
exports.deleteOrganizationById = async (orgId) => {
  try {
    await getMongoConnection();
    const organization = await OrganizationModel.findByIdAndDelete(orgId);
    if (!organization) throw new Error("Organization not found");
    return organization;
  } catch (ex) {
    console.error("❌ exception deleteOrganizationById", ex);
    throw ex;
  }
};

// Add member to organization
exports.addMemberToOrganization = async (orgId, userId, role = "member") => {
  try {
    await getMongoConnection();
    const organization = await OrganizationModel.findById(orgId);
    if (!organization) throw new Error("Organization not found");

    // Check if the user is already a member
    const existingMember = organization.members.find(
      (member) => member.userId.toString() === userId.toString()
    );

    if (existingMember) throw new Error("User is already a member");

    // Add new member
    organization.members.push({ userId: ObjectId(userId), role });

    await organization.save();
    return organization;
  } catch (ex) {
    console.error("❌ exception addMemberToOrganization", ex);
    throw ex;
  }
};

// Remove member from organization
exports.removeMemberFromOrganization = async (orgId, userId) => {
  try {
    await getMongoConnection();
    const organization = await OrganizationModel.findById(orgId);
    if (!organization) throw new Error("Organization not found");

    // Check if the user is a member
    const memberIndex = organization.members.findIndex(
      (member) => member.userId.toString() === userId.toString()
    );

    if (memberIndex === -1)
      throw new Error("User is not a member of this organization");

    // Remove the member
    organization.members.splice(memberIndex, 1);

    await organization.save();
    return organization;
  } catch (ex) {
    console.error("❌ exception removeMemberFromOrganization", ex);
    throw ex;
  }
};

// Assign a new role to a member in the organization
exports.assignRoleToMember = async (orgId, userId, newRole) => {
  try {
    await getMongoConnection();
    const organization = await OrganizationModel.findById(orgId);
    if (!organization) throw new Error("Organization not found");

    const member = organization.members.find(
      (member) => member.userId.toString() === userId.toString()
    );

    if (!member) throw new Error("User is not a member of this organization");

    // Update member's role
    member.role = newRole;

    await organization.save();
    return organization;
  } catch (ex) {
    console.error("❌ exception assignRoleToMember", ex);
    throw ex;
  }
};

// Get all organizations owned by a user (by clientId)
exports.getOrganizationsByOwnerId = async (clientId) => {
  try {
    await getMongoConnection();
    return await OrganizationModel.findOne({ owner: clientId });
  } catch (ex) {
    console.error("❌ exception getOrganizationsByOwnerId", ex);
    return null;
  }
};

// Verify organization by setting isVerified to true
exports.verifyOrganization = async (orgId, status) => {
  try {
    await getMongoConnection();
    const organization = await OrganizationModel.findById(orgId);

    if (!organization) throw new Error("Organization not found");

    console.log({ status });

    if (status === "denied") {
      organization.isVerified = false;
      organization.status = 'denied';
    } else {
      organization.status = 'verified';
      organization.isVerified = true;

      // Ping the /activate-client endpoint
      const activateClientData = {
        org_id: orgId.toString(),
        assistant_type: organization.organization_type,
      };

      try {
        const baseUrl = process.env.SERVER_URL || 'http://localhost:3000';
        const response = await axios.post(
          `${baseUrl}/dev/api/v1/activate-client`,
          activateClientData,
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        console.log('Successfully activated client:', response.data);
      } catch (axiosError) {
        console.error('Failed to activate client:', axiosError.message);
        // Log the error but don't throw to avoid breaking organization verification
      }
    }

    await organization.save();

    return organization;
  } catch (ex) {
    console.error("❌ exception verifyOrganization", ex);
    throw ex;
  }
};