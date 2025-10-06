const { User, Role, Organization, Onboarding } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { HTTP_STATUS_CODES } = require('../helper');

// Fetch user by ID
exports.fetchUser = async (userId) => {
  try {
    const user = await User.findById(userId).populate('role_id');
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (error) {
    throw new Error(`Error fetching user: ${error.message}`);
  }
};

// Login user
exports.loginUser = async (email, password) => {
  try {
    const user = await User.findOne({ email }).populate('role_id');
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return { user, token };
  } catch (error) {
    throw new Error(`Login error: ${error.message}`);
  }
};

// Register new user
exports.registerUser = async (userData, roleName = 'User') => {
  try {
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      throw new Error('Role not found');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user = new User({
      ...userData,
      password: hashedPassword,
      role_id: role._id
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return { user, token };
  } catch (error) {
    throw new Error(`Registration error: ${error.message}`);
  }
};

// Update user
exports.userUpdate = async (updateData) => {
  try {
    const user = await User.findByIdAndUpdate(
      updateData.id,
      { ...updateData },
      { new: true }
    ).populate('role_id');

    if (!user) {
      throw new Error('User not found');
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return { user, token };
  } catch (error) {
    throw new Error(`Update error: ${error.message}`);
  }
};

// Get users list
exports.getUsersList = async (page = 1, limit = 10, search = '', sortField = 'createdAt', sortOrder = -1, groupName = 'User') => {
  try {
    const skip = (page - 1) * limit;
    const query = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstname: { $regex: search, $options: 'i' } },
        { lastname: { $regex: search, $options: 'i' } }
      ];
    }

    const role = await Role.findOne({ name: groupName });
    if (role) {
      query.role_id = role._id;
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .populate('role_id')
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    throw new Error(`Error fetching users list: ${error.message}`);
  }
};

// Delete user
exports.userDelete = async (userId) => {
  try {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return { message: 'User deleted successfully' };
  } catch (error) {
    throw new Error(`Delete error: ${error.message}`);
  }
};

// Switch AI for user
exports.switchAI = async ({ id, aiEnabled }) => {
  try {
    const user = await User.findByIdAndUpdate(
      id,
      { 'permissions.aiAgent': aiEnabled },
      { new: true }
    ).populate('role_id');

    if (!user) {
      throw new Error('User not found');
    }

    return { user };
  } catch (error) {
    throw new Error(`AI switch error: ${error.message}`);
  }
};

// Global AI switch
exports.globalswitchAI = async ({ aiEnabled }) => {
  try {
    await User.updateMany({}, { 'permissions.aiAgent': aiEnabled });
    return { message: 'Global AI switch updated successfully' };
  } catch (error) {
    throw new Error(`Global AI switch error: ${error.message}`);
  }
};

// Get user profile
exports.getMyProfile = async (username) => {
  try {
    const user = await User.findOne({ username }).populate('role_id');
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (error) {
    throw new Error(`Profile fetch error: ${error.message}`);
  }
};

// Get client list
exports.getClientList = async () => {
  try {
    const role = await Role.findOne({ name: 'Client' });
    if (!role) {
      throw new Error('Client role not found');
    }

    const clients = await User.find({ role_id: role._id }).populate('role_id');
    return { clients };
  } catch (error) {
    throw new Error(`Client list fetch error: ${error.message}`);
  }
};

// 2FA related functions
exports.verify2FAToken = async (token) => {
  try {
    // Implement 2FA verification logic here
    return { message: '2FA verification successful' };
  } catch (error) {
    throw new Error(`2FA verification error: ${error.message}`);
  }
};

exports.sendOTP = async (username) => {
  try {
    const user = await User.findOne({ username });
    if (!user) {
      throw new Error('User not found');
    }
    // Implement OTP sending logic here
    return { message: 'OTP sent successfully' };
  } catch (error) {
    throw new Error(`OTP send error: ${error.message}`);
  }
};

exports.verifyOTP = async (username, code, newPassword) => {
  try {
    const user = await User.findOne({ username });
    if (!user) {
      throw new Error('User not found');
    }
    // Implement OTP verification and password reset logic here
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(user._id, { password: hashedPassword });
    return { message: 'Password reset successful' };
  } catch (error) {
    throw new Error(`OTP verification error: ${error.message}`);
  }
};

// Onboarding related functions
exports.onboardUser = async (formData) => {
  try {
    const { personal_info, org_info, contacts, client_id } = formData;

    const user = await User.findById(client_id);
    if (!user) {
      throw new Error('User not found');
    }

    const organization = new Organization({
      ...org_info,
      contacts
    });
    await organization.save();

    const onboarding = new Onboarding({
      user_id: client_id,
      organization_id: organization._id,
      personal_info,
      status: 'completed'
    });
    await onboarding.save();

    return { user, organization };
  } catch (error) {
    throw new Error(`Onboarding error: ${error.message}`);
  }
};

exports.listOnboarding = async (page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;
    const total = await Onboarding.countDocuments();
    const onboardings = await Onboarding.find()
      .populate('user_id')
      .populate('organization_id')
      .skip(skip)
      .limit(limit);

    return {
      onboardings,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    throw new Error(`Onboarding list fetch error: ${error.message}`);
  }
}; 