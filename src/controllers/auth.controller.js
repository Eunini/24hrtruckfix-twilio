const { User, Organization } = require("../models");
const { HTTP_STATUS_CODES } = require("../helper");
const {
  onboardUser,
  verify2FACode,
  send2FACode,
  adminTempUser,
  verifyOnboardingEmail,
} = require("../models/mongo/functions/users");
const {
  loginUser,
  verify2FAToken,
  sendOTP,
  verifyOTP,
  checkOTP,
  registerUser,
  userUpdate,
  getUsersList,
  userDelete,
  switchAI,
  globalswitchAI,
  getMyProfile,
  listOnboarding,
  updateUserSettings,
} = require("../models/mongo/functions/users");

const AuthService = require("../services/auth.service");
const { handleSuccess, handleError } = require("../utils/response.handler");

const authController = {
  loginUser: async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await loginUser(email, password);
      return handleSuccess(res, result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  TempUser: async (req, res) => {
    try {
      const { id } = req.body;
      const result = await adminTempUser(id);
      return handleSuccess(res, result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  registerUser: async (req, res) => {
    try {
      const { roleName } = req.query;

      const result = await registerUser(
        req.body.user,
        req.body?.user?.groupName || roleName
      );
      return handleSuccess(res, result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  verify2FAToken: async (req, res) => {
    try {
      const { token } = req.body;
      const result = await verify2FAToken(token);
      return handleSuccess(res, result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  verify2FACode: async (req, res) => {
    // console.log(req)
    try {
      const { code, email } = req.body;
      const result = await verify2FACode(email, code);
      return handleSuccess(res, result);
    } catch (error) {
      console.log(error);
      return handleError(res, error);
    }
  },

  send2FACode: async (req, res) => {
    // console.log(req)
    try {
      const { email } = req.body;
      const result = await send2FACode(email);
      return handleSuccess(res, result);
    } catch (error) {
      console.log(error);
      return handleError(res, error);
    }
  },

  customForgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      // console.log(req.body, email)
      if (!email) {
        return handleError(
          res,
          "email is required",
          HTTP_STATUS_CODES.BAD_REQUEST
        );
      }
      await sendOTP(email);
      return handleSuccess(res, null, "OTP sent to email.");
    } catch (error) {
      return handleError(res, error);
    }
  },

  customResetPassword: async (req, res) => {
    try {
      const { username, code, newPassword } = req.body;
      if (!username || !code || !newPassword) {
        return handleError(
          res,
          "All fields are required",
          HTTP_STATUS_CODES.BAD_REQUEST
        );
      }
      await verifyOTP(username, code, newPassword);
      return handleSuccess(res, null, "Password reset successfully");
    } catch (error) {
      return handleError(res, error);
    }
  },

  customOTP: async (req, res) => {
    try {
      console.log(req.body);
      const { username, code } = req.body;
      if (!username || !code) {
        return handleError(
          res,
          "All fields are required",
          HTTP_STATUS_CODES.BAD_REQUEST
        );
      }
      await checkOTP(username, code);
      return handleSuccess(res, null, "OTP checked successfully");
    } catch (error) {
      return handleError(res, error);
    }
  },

  getMyProfile: async (req, res) => {
    try {
      const result = {
        username: `${req.user.firstname || ""} ${req.user.lastname || ""}`,
        email: req.user.email,
        phone: req.user.phoneNumber,
        emailNotification: req.user.notificationSettings.email,
        smsNotification: req.user.notificationSettings.sms,
        pushNotification: req.user.notificationSettings.push,
        twoFactorEnabled: req.user.twoFactorEnabled,
        language: req.user.preferences.language,
        timezone: req.user.preferences.timezone,
        image: req.user.image,
        imageType: req.user.imageContentType,
        theme: req.user.preferences.theme,
      };
      return handleSuccess(res, result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  updateUserSettings: async (req, res) => {
    try {
      const result = await updateUserSettings(req.body);
      return handleSuccess(res, result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  userOrg: async (req, res) => {
    try {
      const userId = req.user.userId;
      // console.log(req.user, "req.user")
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      // Check for user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Usernot found" });
      }
      const userOrg = await Organization.findOne({
        $or: [{ owner: userId }, { "members.user": userId }],
      });
      let orgType = userOrg?.organization_type.toString();
      let name = userOrg?.companyName || userOrg?.keyBillingContactName;

      if (!userOrg) {
        return res.status(404).json({ message: "User organization not found" });
      }
      // console.log(user, userOrg, orgType)
      return res.status(200).json({
        message: "User updated successfully",
        organization: userOrg,
        type: orgType,
        name,
      });
    } catch (error) {
      console.error("Exception in orgType:", error);
      throw error;
    }
  },

  profileUpdate: async (req, res) => {
    try {
      const result = await userUpdate({ body: req.body, user: req.user });
      return handleSuccess(res, result, "Profile updated successfully");
    } catch (error) {
      return handleError(res, error);
    }
  },

  //upload user image
  profileUploadImage: async (req, res) => {
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
      const result = await User.findOneAndUpdate(
        { _id: username },
        {
          $set: {
            image: imgBuffer,
            imageContentType: mimeType,
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
  },

  // get image
  getProfileImage: async (req, res) => {
    try {
      const username = req.user.userId;
      let org;
      org = await User.findOne({ _id: username }).select(
        "image imageContentType"
      );
      if(!org) {
        org = await User.findOne({ email: username }).select(
        "image imageContentType"
      );
      } else if(!org || !org.image) {
        return res.status(HTTP_STATUS_CODES.NOT_FOUND).send("Image not found");
      }

      res.set("Content-Type", org.imageContentType);
      return res.send(org.image);
    } catch (err) {
      console.error("fetch image error:", err);
      return res
        .status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR)
        .json({ message: err.message });
    }
  },

  getUsersList: async (req, res) => {
    try {
      const {
        page = 0,
        search = "",
        sortField = "createdAt",
        sort = -1,
        groupName = "Agent",
      } = req.query;
      const result = await getUsersList(
        page,
        10,
        search,
        sortField,
        sort,
        groupName
      );
      return handleSuccess(res, result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  getUserById: async (req, res) => {
    try {
      const result = await getMyProfile(req.params.id);
      return handleSuccess(res, result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  getUserById: async (req, res) => {
    try {
      const result = await getMyProfile(req.params.id);
      return handleSuccess(res, result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  userUpdate: async (req, res) => {
    try {
      const result = await userUpdate(req.params.id, req.body);
      return handleSuccess(res, result, "User updated successfully");
    } catch (error) {
      return handleError(res, error);
    }
  },

  userDelete: async (req, res) => {
    try {
      const result = await userDelete(req.params.id);
      return handleSuccess(res, result, "User deleted successfully");
    } catch (error) {
      return handleError(res, error);
    }
  },

  switchAI: async (req, res) => {
    try {
      const result = await switchAI(req.body.userId, req.body.aiswitch);
      return handleSuccess(res, result, "AI switched successfully");
    } catch (error) {
      return handleError(res, error);
    }
  },

  globalswitchAI: async (req, res) => {
    try {
      const result = await globalswitchAI(
        req.body.userId,
        req.body.globalaiswitch,
        req.body.role
      );
      return handleSuccess(res, result, "Global AI switched successfully");
    } catch (error) {
      return handleError(res, error);
    }
  },

  verifyOnboard: async (req, res) => {
    try {
      const result = await verifyOnboardingEmail(req.body);
      return handleSuccess(res, result, "Email Verified successfully");
    } catch (error) {
      return handleError(res, error);
    }
  },

  onboarding: async (req, res) => {
    try {
      const result = await onboardUser(req.body);
      return handleSuccess(res, result, "Onboarding completed successfully");
    } catch (error) {
      return handleError(res, error);
    }
  },

  listOnboarding: async (req, res) => {
    try {
      const { page = 0 } = req.query;
      const result = await listOnboarding(page, 10);
      return handleSuccess(res, result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  getAdminDetails: async (req, res) => {
    try {
      const result = await AuthService.getAdminDetails();
      return handleSuccess(res, result);
    } catch (error) {
      return handleError(res, error);
    }
  },

  createKeyContact: async (req, res) => {
    try {
      const result = await AuthService.createKeyContact(req.body);
      return handleSuccess(res, result, "Key contact created successfully");
    } catch (error) {
      return handleError(res, error);
    }
  },

  getKeyContacts: async (req, res) => {
    try {
      const result = await AuthService.getKeyContacts();
      return handleSuccess(res, result);
    } catch (error) {
      return handleError(res, error);
    }
  },
};

module.exports = authController;
