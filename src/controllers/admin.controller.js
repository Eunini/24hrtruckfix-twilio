const { HTTP_STATUS_CODES } = require('../helper');
const { Policy } = require('../models');
const { OrganizationModel } = require('../models');

// Search policies by name and number
exports.searchByNameAndNumber = async (req, res) => {
  try {
    const { search_str } = req.params;
    const { client_id } = req.query;
    const userId = req.user.userId;
    const userRole = req.user.role;

    let query = {
      $or: [
        { name: { $regex: search_str, $options: 'i' } },
        { policyNumber: { $regex: search_str, $options: 'i' } }
      ]
    };

    // If not admin/superadmin, filter by organization
    if (!['admin', 'super_admin'].includes(userRole)) {
      const userOrg = await OrganizationModel.findOne({
        $or: [{ owner: userId }],
      });
      
      if (!userOrg) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
      }
      
      query.organization_id = userOrg._id;
    }

    if (client_id) {
      query.clientId = client_id;
    }

    const policies = await Policy.find(query);
    res.json({ success: true, data: policies });
  } catch (error) {
    console.error('Error searching policies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all policies
exports.getAllPolicies = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;
    
    let query = {};

    // If not admin/superadmin, filter by organization
    if (!['admin', 'super_admin'].includes(userRole)) {
      const userOrg = await OrganizationModel.findOne({
        $or: [{ owner: userId }],
      });
      
      if (!userOrg) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
      }
      
      query.organization_id = userOrg._id;
    }

    const policies = await Policy.find(query);
    res.json({ success: true, data: policies });
  } catch (error) {
    console.error('Error getting policies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create new policy
exports.createPolicy = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user's organization
    const userOrg = await OrganizationModel.findOne({
      $or: [{ owner: userId }],
    });
    
    if (!userOrg) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }
    
    const policy = new Policy({
      ...req.body,
      organization_id: userOrg._id
    });
    
    await policy.save();
    res.status(201).json({ success: true, data: policy });
  } catch (error) {
    console.error('Error creating policy:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update policy
exports.updatePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    // If not admin/superadmin, verify organization ownership
    if (!['admin', 'super_admin'].includes(userRole)) {
      const userOrg = await OrganizationModel.findOne({
        $or: [{ owner: userId }],
      });
      
      if (!userOrg) {
        return res.status(404).json({ success: false, error: 'Organization not found' });
      }

      // Check if policy belongs to user's organization
      const existingPolicy = await Policy.findById(id);
      if (!existingPolicy || existingPolicy.organization_id.toString() !== userOrg._id.toString()) {
        return res.status(403).json({ success: false, error: 'Not authorized to update this policy' });
      }
    }

    const policy = await Policy.findByIdAndUpdate(id, req.body, { new: true });
    if (!policy) {
      return res.status(404).json({ success: false, error: 'Policy not found' });
    }
    res.json({ success: true, data: policy });
  } catch (error) {
    console.error('Error updating policy:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get single policy
exports.getPolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const policy = await Policy.findById(id);
    if (!policy) {
      return res.status(404).json({ success: false, error: 'Policy not found' });
    }
    res.json({ success: true, data: policy });
  } catch (error) {
    console.error('Error getting policy:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all policies for admin with additional details
exports.getAllPoliciesForAdmin = async (req, res) => {
  try {
    const policies = await Policy.find()
      .populate('clientId', 'name email')
      .populate('createdBy', 'name email');
    res.json({ success: true, data: policies });
  } catch (error) {
    console.error('Error getting admin policies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get analysis
exports.getAnalysis = async (req, res) => {
  try {
    const totalPolicies = await Policy.countDocuments();
    const activePolicies = await Policy.countDocuments({ status: 'active' });
    const expiredPolicies = await Policy.countDocuments({ status: 'expired' });
    
    const analysis = {
      total: totalPolicies,
      active: activePolicies,
      expired: expiredPolicies
    };
    
    res.status(HTTP_STATUS_CODES.OK).json(analysis);
  } catch (error) {
    console.error('getAnalysis error:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Create admin policy
exports.createAdminPolicy = async (req, res) => {
  try {
    const policy = new Policy(req.body);
    const result = await policy.save();
    res.status(HTTP_STATUS_CODES.CREATED).json(result);
  } catch (error) {
    console.error('createAdminPolicy error:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Update admin policy
exports.updateAdminPolicy = async (req, res) => {
  try {
    const policy = await Policy.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!policy) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ message: 'Policy not found' });
    }
    res.status(HTTP_STATUS_CODES.OK).json(policy);
  } catch (error) {
    console.error('updateAdminPolicy error:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Get admin policy by ID
exports.getAdminPolicy = async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);
    if (!policy) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ message: 'Policy not found' });
    }
    res.status(HTTP_STATUS_CODES.OK).json(policy);
  } catch (error) {
    console.error('getAdminPolicy error:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Search admin policy by name and number
exports.searchAdminPolicyByNameAndNumber = async (req, res) => {
  try {
    const searchStr = req.params.search_str;
    const policies = await Policy.find({
      $or: [
        { policy_name: { $regex: searchStr, $options: 'i' } },
        { policy_number: { $regex: searchStr, $options: 'i' } }
      ]
    });
    res.status(HTTP_STATUS_CODES.OK).json(policies);
  } catch (error) {
    console.error('searchAdminPolicyByNameAndNumber error:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
};

// Get all admin policies
exports.getAllAdminPolicies = async (req, res) => {
  try {
    const policies = await Policy.find({ type: 'admin' });
    res.status(HTTP_STATUS_CODES.OK).json(policies);
  } catch (error) {
    console.error('getAllAdminPolicies error:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ message: error.message });
  }
}; 