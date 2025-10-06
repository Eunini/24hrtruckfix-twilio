const { User } = require('../models');
const { HTTP_STATUS_CODES } = require('../helper');

// Get list of all users
exports.getUsersList = async (req, res) => {
  try {
    const users = await User.find().populate('role_id');
    res.status(HTTP_STATUS_CODES.OK).json({ success: true, data: users });
  } catch (error) {
    console.error('Error getting users list:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ success: false, error: error.message });
  }
};

// Get list of client users
exports.getClientList = async (req, res) => {
  try {
    const clients = await User.find({ 'permissions.portalAccess': true }).populate('role_id');
    res.status(HTTP_STATUS_CODES.OK).json({ success: true, data: clients });
  } catch (error) {
    console.error('Error getting client list:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ success: false, error: error.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('role_id');
    if (!user) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ success: false, message: 'User not found' });
    }
    res.status(HTTP_STATUS_CODES.OK).json({ success: true, data: user });
  } catch (error) {
    console.error('Error getting user by ID:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ success: false, error: error.message });
  }
};

// Update user
exports.userUpdate = async (req, res) => {
  try {
    const { id, ...updateData } = req.body;
    const user = await User.findByIdAndUpdate(id, updateData, { new: true });
    if (!user) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ success: false, message: 'User not found' });
    }
    res.status(HTTP_STATUS_CODES.OK).json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ success: false, error: error.message });
  }
};

// Update user profile
exports.profileUpdate = async (req, res) => {
  try {
    const { id, ...profileData } = req.body;
    const user = await User.findByIdAndUpdate(id, profileData, { new: true });
    if (!user) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ success: false, message: 'User not found' });
    }
    res.status(HTTP_STATUS_CODES.OK).json({ success: true, data: user });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ success: false, error: error.message });
  }
};

// Upload profile image
exports.profileUploadImage = async (req, res) => {
  try {
    const { id, imageUrl } = req.body;
    const user = await User.findByIdAndUpdate(id, { image: imageUrl }, { new: true });
    if (!user) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ success: false, message: 'User not found' });
    }
    res.status(HTTP_STATUS_CODES.OK).json({ success: true, data: user });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ success: false, error: error.message });
  }
};

// Delete user
exports.userDelete = async (req, res) => {
  try {
    const { id } = req.body;
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ success: false, message: 'User not found' });
    }
    res.status(HTTP_STATUS_CODES.OK).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ success: false, error: error.message });
  }
};

// Switch AI for user
exports.switchAI = async (req, res) => {
  try {
    const { id, aiEnabled } = req.body;
    const user = await User.findByIdAndUpdate(id, { 'permissions.aiAgent': aiEnabled }, { new: true });
    if (!user) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ success: false, message: 'User not found' });
    }
    res.status(HTTP_STATUS_CODES.OK).json({ success: true, data: user });
  } catch (error) {
    console.error('Error switching AI:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ success: false, error: error.message });
  }
};

// Switch AI globally
exports.globalswitchAI = async (req, res) => {
  try {
    const { aiEnabled } = req.body;
    await User.updateMany({}, { 'permissions.aiAgent': aiEnabled });
    res.status(HTTP_STATUS_CODES.OK).json({ success: true, message: 'AI switched globally' });
  } catch (error) {
    console.error('Error switching AI globally:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ success: false, error: error.message });
  }
};

// Get admin details
exports.getAdminDetails = async (req, res) => {
  try {
    const admins = await User.find({ 'permissions.managementConsole': true }).populate('role_id');
    res.status(HTTP_STATUS_CODES.OK).json({ success: true, data: admins });
  } catch (error) {
    console.error('Error getting admin details:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ success: false, error: error.message });
  }
};

// User onboarding
exports.onboarding = async (req, res) => {
  try {
    const { id, ...onboardingData } = req.body;
    const user = await User.findByIdAndUpdate(id, { 
      ...onboardingData,
      onboardUser: true 
    }, { new: true });
    if (!user) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ success: false, message: 'User not found' });
    }
    res.status(HTTP_STATUS_CODES.OK).json({ success: true, data: user });
  } catch (error) {
    console.error('Error in onboarding:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ success: false, error: error.message });
  }
}; 