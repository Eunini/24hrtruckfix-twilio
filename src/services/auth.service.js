const { User, Role} = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const UserService = require('../models/mongo/functions/users');
const { sendWelcomeEmail } = require('./mail/welcomemail');
const { sendVerificationEmail } = require('./mail/conformationmail');
const { Organization } = require('../models');

// AWS Configuration
const s3 = new AWS.S3();
const S3_BUCKET_NAME = process.env.PROFILE_IMG_UPLOAD_BUCKET;

class AuthService {
  static async loginUser(email, password) {
    try {
      const user = await User.findByCredentials(email, password);
      
      const organization = await Organization.findOne({
        $or: [{ owner: user._id }]
      }).select('status isVerified');

      const orgStatus = organization?.status || null;
      const isOrgVerified = organization?.isVerified || false;

      if (user.twoFactorEnabled) {
        const token = user.generate2FAToken();
        // const verificationLink = `${process.env.NEXT_PUBLIC_BASE_URL}/2FA/authentication/${token}`;
        await sendVerificationEmail(user.email, user.username, token);

        return {
          user: {
            _id: user._id,
            username: user.username,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
            role: user.role_id.name,
            twoFactorEnabled: user.twoFactorEnabled,
            apikey: user.apiKey,
            org_status: orgStatus,
            is_org_verified: isOrgVerified,
          },
          requires2FA: true
        };
      }

      const token = user.generateToken();
      console.log(user.username,"------___________----------__________________-----------" ,{user}, "--------__________----------------------")
      return {
        token,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          role: user.role_id.name,
          twoFactorEnabled: user.twoFactorEnabled,
          apikey: user.apiKey,
          org_status: orgStatus,
          is_org_verified: isOrgVerified,
        }
      };
    } catch (error) {
      throw error;
    }
  }

  static async registerUser(userData, roleName) {
    try {
      const result = await UserService.registerUser(userData, roleName);
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async verify2FAToken(token) {
    try {
      const result = await UserService.verify2FAToken(token);
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async updateProfile(userId, updateData) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Handle image upload if present
      if (updateData.image) {
        const matches = updateData.image.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (matches) {
          const extension = matches[1];
          const base64Data = Buffer.from(matches[2], 'base64');
          const uniqueFilename = `${uuidv4()}.${extension}`;

          await s3.upload({
            Bucket: S3_BUCKET_NAME,
            Key: uniqueFilename,
            Body: base64Data,
            ContentType: `image/${extension}`,
            ACL: 'public-read'
          }).promise();

          updateData.image = uniqueFilename;
        }
      }

      Object.assign(user, updateData);
      await user.save();
      return user;
    } catch (error) {
      throw error;
    }
  }

  static async getProfile(userId) {
    try {
      const user = await User.findById(userId).populate('role_id');
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      throw error;
    }
  }

  static async deleteUser(userId) {
    try {
      const result = await UserService.deleteUser(userId);
      return result;
    } catch (error) {
      throw error;
    }
  }

  static async handle2FA(userId, action) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.twoFactorEnabled = action === 'enable';
      await user.save();
      return user;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = AuthService; 