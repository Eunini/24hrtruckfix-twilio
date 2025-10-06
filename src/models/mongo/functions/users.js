const {
  User,
  Organization,
  Role,
  Mechanic,
  Onboarding,
} = require("../../index");
const { generateRandomPassword } = require("../../../helper");
const { sendWelcomeEmail } = require("../../../services/mail/welcomemail");
const {
  sendVerificationEmail,
} = require("../../../services/mail/conformationmail");
const {
  sendForgotPasswordEmail,
} = require("../../../services/mail/forgotpasswordmail");
const {
  sendAccountApprovalPendingEmail,
} = require("../../../services/mail/accountapprovalpendingmail");
const {
  sendApprovalRequestEmail,
} = require("../../../services/mail/sendapprovalrequestmail");
const { sendApprovalEmail } = require("../../../services/mail/approvalmail");
const { sendNewClientrigger } = require("../triggers/sendNewClientTrigger");

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const {
  UploadPartCopyRequestFilterSensitiveLog,
} = require("@aws-sdk/client-s3");

const JWT_SECRET = process.env.JWT_SECRET;

class UserService {
  static async createNewUser(userDetails, role) {
    try {
      const password = await generateRandomPassword();

      const newUser = new User({
        email: userDetails.email_1,
        phone: userDetails.mobile_num,
        username: `${userDetails.first_name}_${userDetails.last_name}`,
        firstname: userDetails.first_name,
        lastname: userDetails.last_name,
        role,
        password, // Will be hashed by pre-save middleware
      });

      await newUser.save();
      await sendWelcomeEmail(userDetails.email_1, newUser.username, password);
      return newUser;
    } catch (error) {
      console.error("Exception in createNewUser:", error);
      throw error;
    }
  }

  static async loginUser(email, password) {
    try {
      const user = await User.findByCredentials(email, password);
      if(user?.status === "denied" 
        // || user?.status === "pending"
      ) {
        throw new Error("This User's access has been revoked")
      }

      const organization = await Organization.findOne({
        $or: [{ owner: user._id }],
      }).select("status isVerified");
      console.log("organization", organization);
      const orgStatus = organization?.status || null;
      const isOrgVerified = organization?.isVerified || false;

      const responseData = {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          role: user.role_id,
          twoFactorEnabled: user.twoFactorEnabled,
          apikey: user.apiKey,
          org_status: orgStatus,
          is_org_verified: isOrgVerified,
        },
      };

      if (user.twoFactorEnabled === true) {
        const token = await user.generate2FACode();
        // console.log("token", token);
        // const verificationLink = `${process.env.NEXT_PUBLIC_BASE_URL}/2FA/authentication/${token}`;
        // await sendVerificationEmail(user.email, user.username, verificationLink);
        await sendVerificationEmail(user.email, user.username, token);

        return {
          ...responseData,
          message: "2FA is enabled. Please check your email.",
          // tempToken: token
        };
      }

      const token = user.generateToken();
      return {
        ...responseData,
        token,
      };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  static async adminTempUser(id) {
    try {


      const organization = await Organization.findById(id)
      const userId = organization?.owner

      if(!organization && !userId) {
        console.error("Can not find Organization or it's Owner")
      }
      const user = await User.findById(userId)

      if(!user) {
        console.error("User Not found")
      }

      console.log("organization", organization);
      const orgStatus = organization?.status || null;
      const isOrgVerified = organization?.isVerified || false;

      

      const responseData = {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          role: user.role_id,
          twoFactorEnabled: user.twoFactorEnabled,
          apikey: user.apiKey,
          org_status: orgStatus,
          is_org_verified: isOrgVerified,
        },
      };

      const token = user.generateToken();
      return {
        ...responseData,
        token,
      };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  static async send2FACode(email) {
    if (!email) {
      throw new Error("email is required");
    }
    try {
      const user = await User.findOne({ email: email });
      if (!user) {
        throw new Error("User not found");
      }

      if (user.twoFactorEnabled) {
        const token = await user.generate2FACode();
        await sendVerificationEmail(user.email, user.username, token);
      }

      return {
        message: "2FA auth mail sent. Please check your email.",
      };
    } catch (error) {
      console.error("2FA Auth email failed:", error);
      throw error;
    }
  }

  static async verify2FACode(email, code) {
    if (!code) {
      throw new Error("6-digit Code is required");
    }
    try {
      const user = await User.findOne({ email: email }).populate("role_id");
      if (!user) {
        throw new Error("User not found");
      }

      const valid = await user.verify2FACode(code);
      if (!valid) {
        throw new Error("Invalid or expired 2FA Code.");
      }

      const organization = await Organization.findOne({
        $or: [{ owner: user._id }],
      }).select("status isVerified");
      console.log("organization", organization);
      const orgStatus = organization?.status || null;
      const isOrgVerified = organization?.isVerified || false;
      const token = user.generateToken();
      const responseData = {
        user: {
          username: user.username,
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          role: user.role_id.name,
          _id: user._id,
          twoFactorEnabled: user.twoFactorEnabled,
          apikey: user.apiKey,
          org_status: orgStatus,
          is_org_verified: isOrgVerified,
        },
      };
      return {
        ...responseData,
        token,
      };
    } catch (error) {
      console.error("Token verification failed:", error);
      throw error;
    }
  }

  static async verify2FAToken(token) {
    if (!token) {
      throw new Error("Token is required");
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (!decoded.is2FA) {
        throw new Error("Invalid 2FA token");
      }

      const user = await User.findById(decoded.userId).populate("role_id");
      if (!user) {
        throw new Error("User not found");
      }

      const newToken = user.generateToken();
      return {
        message: "2FA verification successful",
        token: newToken,
        user: {
          username: user.username,
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          role: user.role_id.name,
          _id: user._id,
        },
      };
    } catch (error) {
      console.error("Token verification failed:", error);
      throw error;
    }
  }

  static async sendOTP(email) {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error("User not found");
      }

      const otp = crypto.randomInt(100000, 999999).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();

      await sendForgotPasswordEmail( email, otp );
      // console.log({email}, {otp})
      return user;
    } catch (error) {
      console.error("Error in sendOTP:", error);
      throw error;
    }
  }

  static async verifyOTP(username, otp, newPassword) {
    try {
      const user = await User.findOne({ email: username });
      if (!user) {
        throw new Error("User not found");
      }

      if (user.otp !== otp || user.otpExpires < new Date()) {
        throw new Error("Invalid OTP or OTP has expired");
      }

      user.password = newPassword; // Will be hashed by pre-save middleware
      user.otp = null;
      user.otpExpires = null;
      await user.save();

      return user;
    } catch (error) {
      console.error("Error in verifyOTP:", error);
      throw error;
    }
  }

  static async checkOTP(username, otp) {
    try {
      const user = await User.findOne({ email: username });
      if (!user) {
        throw new Error("User not found");
      }

      if (user.otp !== otp || user.otpExpires < new Date()) {
        throw new Error("Invalid OTP or OTP has expired");
      }

      return {
        message: "OTP Valid",
        OTP: otp,
      };
    } catch (error) {
      console.error("Error in checking OTP:", error);
      throw error;
    }
  }

  static async registerUser(userData, roleName) {
    try {
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error("Email already exists");
      }

      const role = await Role.findOne({ name: roleName.toLowerCase() });
      if (!role) {
        throw new Error(`Role "${roleName}" not found`);
      }

      const apiKey = await bcrypt.hash(
        `${userData.email}:${userData.password}`,
        10
      );
      const username = userData.email + Math.floor(Math.random() * 10000);

      const newUser = new User({
        ...userData,
        username,
        status: "pending",
        role_id: role._id,
        apiKey,
      });

      const savedUser = await newUser.save();

      savedUser.role = role.name;

      await sendWelcomeEmail(savedUser.email, savedUser.username);

      const token = savedUser.generateToken();
      return {
        message: "User registered successfully",
        token,
        user: savedUser,
      };
    } catch (error) {
      console.error("Exception in registerUser:", error);
      throw error;
    }
  }

  static async updateUser(userData) {
    try {
      const { username, groupName, ...updateData } = userData;

      if (updateData.phoneNumber) {
        const existingUserWithPhone = await User.findOne({
          phoneNumber: updateData.phoneNumber,
          username: { $ne: username },
        });
        if (existingUserWithPhone) {
          throw new Error("Mobile number already exists in another user");
        }
      }

      if (groupName) {
        const role = await Role.findOne({ name: groupName });
        if (!role) {
          throw new Error(`Role ${groupName} not found`);
        }
        updateData.role_id = role._id;
      }

      const updatedUser = await User.findOneAndUpdate(
        { username },
        { $set: updateData },
        { new: true }
      );

      if (!updatedUser) {
        throw new Error("User not found");
      }

      if (userData.servicesRequested) {
        await Onboarding.findOneAndUpdate(
          { user_id: updatedUser._id },
          { $set: { servicesRequested: userData.servicesRequested } },
          { new: true }
        );
      }

      return {
        message: "User updated successfully",
        user: updatedUser,
      };
    } catch (error) {
      console.error("Exception in updateUser:", error);
      throw error;
    }
  }

  static async getUsersList(
    page = 0,
    limit = 10,
    search = "",
    sortField = "createdAt",
    sort = -1,
    groupName = "Agent"
  ) {
    try {
      const role = await Role.findOne({ name: groupName });
      if (!role) {
        throw new Error(`Role ${groupName} not found`);
      }

      const query = { role_id: role._id };

      if (search.trim()) {
        const searchTerms = search.split(" ").filter((term) => term.trim());
        query.$and = searchTerms.map((term) => ({
          $or: [
            { firstname: { $regex: term, $options: "i" } },
            { lastname: { $regex: term, $options: "i" } },
            { username: { $regex: term, $options: "i" } },
            { email: { $regex: term, $options: "i" } },
            { phoneNumber: { $regex: term, $options: "i" } },
            { twilioNumber: { $regex: term, $options: "i" } },
          ],
        }));
      }

      const options = {
        page,
        limit,
        sort: { [sortField]: Number(sort) },
      };

      const usersList = await User.paginate(query, options);

      const usersWithServices = await Promise.all(
        usersList.docs.map(async (user) => {
          const onboardingData = await Onboarding.findOne(
            { user_id: user._id },
            "servicesRequested"
          );

          return {
            user: user.toObject(),
            servicesRequested: onboardingData?.servicesRequested || null,
          };
        })
      );

      return {
        usersList: {
          docs: usersWithServices,
          totalDocs: usersList.totalDocs,
          limit: usersList.limit,
          totalPages: usersList.totalPages,
          page: usersList.page,
          pagingCounter: usersList.pagingCounter,
          hasPrevPage: usersList.hasPrevPage,
          hasNextPage: usersList.hasNextPage,
          prevPage: usersList.prevPage,
          nextPage: usersList.nextPage,
        },
      };
    } catch (error) {
      console.error("Exception in getUsersList:", error);
      throw error;
    }
  }

  static async deleteUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      await User.deleteOne({ _id: userId });
      return user;
    } catch (error) {
      console.error("Exception in deleteUser:", error);
      throw error;
    }
  }

  static async switchAI(userId, aiswitch) {
    try {
      const updateData = {
        aiswitch,
        beforeaistatus: aiswitch,
      };

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      );

      if (!updatedUser) {
        throw new Error(`User with ID ${userId} not found`);
      }

      return updatedUser;
    } catch (error) {
      console.error("Error in switchAI:", error);
      throw error;
    }
  }

  static async globalSwitchAI(userId, globalaiswitch, role) {
    try {
      if (role !== "Admin") {
        throw new Error("Only Admin can access the global switch");
      }

      const filter = globalaiswitch
        ? { beforeaistatus: true }
        : { aiswitch: true };
      const updateFields = globalaiswitch
        ? { globalaiswitch: true, aiswitch: true }
        : { aiswitch: false, beforeaistatus: true };

      // Update the admin user's global switch status
      await User.findByIdAndUpdate(userId, { $set: { globalaiswitch } });

      // Update all affected users
      const updateAllUsers = await User.updateMany(filter, {
        $set: updateFields,
      });

      return {
        message: `AI switched ${
          globalaiswitch ? "off" : "on"
        } for all users by admin`,
        updatedCount: updateAllUsers.nModified,
      };
    } catch (error) {
      console.error("Error in globalSwitchAI:", error);
      throw error;
    }
  }

  static async addUsers(data) {
    const {
      companyDetails: { primaryContactEmail, primaryContactName },
      role,
      customerSales: { keyBillingContactPhone },
      twoFactorEnabled,
      mechanicLocationLongitude,
      mechanicLocationLatitude,
    } = data;

    try {
      const existingUser = await User.findOne({
        phoneNumber: keyBillingContactPhone,
      });
      if (existingUser) {
        throw {
          message: `Phone number ${keyBillingContactPhone} is already associated with another account.`,
        };
      }

      const password = await generateRandomPassword();
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const roleRecord = await Role.findOne({ name: role });
      if (!roleRecord) {
        throw new Error(`Role ${role} not found`);
      }

      let baseUsername = primaryContactEmail.split("@")[0];
      const randomSuffix = Math.floor(Math.random() * 10000);
      const username = `${baseUsername}${randomSuffix}`;

      const apiKey = await bcrypt.hash(`${username}:${password}`, 10);

      if (role === "serviceprovider") {
        const mechanicData = {
          firstName: primaryContactName,
          lastName: primaryContactName,
          email: primaryContactEmail,
          mobileNumber: keyBillingContactPhone,
          mechanicLocationLatitude: mechanicLocationLatitude,
          mechanicLocationLongitude: mechanicLocationLongitude,
        };

        await Mechanic.create(mechanicData);
      }

      const newUser = await User.create({
        username,
        firstname: primaryContactName,
        lastname: primaryContactName,
        email: primaryContactEmail,
        phoneNumber: keyBillingContactPhone,
        status: "Enabled",
        role_id: roleRecord._id,
        password: hashedPassword,
        onboardUser: true,
        twoFactorEnabled: twoFactorEnabled === "true",
        apiKey,
      });

      return { newUser, role: roleRecord.name };
    } catch (error) {
      console.error("Exception in addUsers:", error);
      throw new Error(error.message);
    }
  }

  static async createOnboarding(data) {
    console.log({data})
    try {
      const { twoFactorEnabled, ...onboardingData } = data;

      const bankingDetails = {
        bankName: data.bankingDetails.bankName,
        bankAddress: data.bankingDetails.bankAddressInformation,
        routingNumber: data.bankingDetails.routingNumber,
        accountNumber: data.bankingDetails.accountNumber,
        transactionalAccountsInUse:
          data.bankingDetails.transactionalAccountsInUse === "Yes",
        readOnlyAccessGranted:
          data.bankingDetails.readOnlyAccessGranted === "Yes",
      };

      const { newUser, role } = await this.addUsers(data);

      const newOnboarding = await Onboarding.create({
        ...onboardingData,
        bankingDetails,
        user_id: newUser._id,
      });

      const userOrg = Organization.findOne({
          $or: [{ owner: newUser._id }, { "members.user": newUser._id }],
      })
      const userType = userOrg.organization_type
      const formatRoleDisplay = (role) => {
        let name;
        if (typeof role === "string") {
          name = role.name;
        } else if (
          role &&
          typeof role === "object" &&
          typeof role.name === "string"
        ) {
          name = role.name;
        }
        if (!name) {
          return (name = role.name);
        }
        switch (name.toLowerCase()) {
          case "fleet":
            return "Fleet";
          case "insurance":
            return "Insurance";
          case "owner_operator":
            return "Owner Operator";
          default:
            return name.charAt(0).toUpperCase() + name.slice(1);
        }
      };

      await sendAccountApprovalPendingEmail(newUser.email, newUser.username, formatRoleDisplay(userType));
      await sendApprovalRequestEmail(role, newUser.username);

      return newOnboarding;
    } catch (error) {
      console.error("Exception in createOnboarding", error);
      throw error;
    }
  }

  static async verifyOnboardingEmail(data) {
       try {
      const { contacts } = data;

      // console.log(data);
      const existingUser = await User.findOne({
        email: contacts?.main_contact.email,
      });
      if (existingUser) {
        throw new Error("User with this email already exists");
      }
     } catch (error) {
      let errorMessage;
      if (error.code === 11000) {
         errorMessage = "Email already exists";
      } else if (error.message.includes("validation failed")) { 
          errorMessage = "Email already exists";
      } else {
        errorMessage = error.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  static async onboardUser(onboardingData) {
    try {
      const { personal_info, org_info, contacts, client_id } = onboardingData;

      console.log(onboardingData);
      const existingUser = await User.findOne({
        email: contacts?.main_contact.email,
      });
      if (existingUser) {
        throw new Error("User with this email already exists");
      }
      const user = await User.findById(client_id);
      if (!user) {
        throw new Error("Client not found");
      }

      user.firstname = personal_info.first_name;
      user.lastname = personal_info.last_name;
      user.phoneNumber = personal_info.cell_number;

      const orgData = {
        owner: user._id,
        companyName: org_info.company_name,
        companyWebsite: org_info.company_website || null,
        companyAddress: org_info.company_address,
        businessEntityType: org_info.business_entity_type,
        organization_type: org_info.org_type.toLowerCase().replace(" ", "_"),

        keyBillingContactEmail: contacts.main_contact.email,
        keyBillingContactName: contacts.main_contact.name,
        keyBillingContactPhone: contacts.main_contact.phone,
        approverBillingContactName: contacts.billing_contact.name,
        approverBillingContactEmail: contacts.billing_contact.email,
        approverBillingContactPhone: contacts.billing_contact.phone,
        billingContactSameAsMain: contacts.billing_contact.same_as_main,
        escalationContactName: contacts.escalation_contact.name,
        escalationContactEmail: contacts.escalation_contact.email,
        escalationContactPhone: contacts.escalation_contact.phone,
        escalationContactSameAsMain: contacts.escalation_contact.same_as_main,

        status: "pending",
      };

      const organization = await Organization.create(orgData);
      await user.save();

      return {
        user: {
          _id: user._id,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          phoneNumber: user.phoneNumber,
        },
        organization: {
          _id: organization._id,
          name: organization.companyName,
          status: organization.status,
        },
      };
    } catch (error) {
      console.error("Onboarding error:", error);
      let errorMessage = "Onboarding failed";
      if (error.code === 11000) {
        errorMessage = "Email already exists";
      } else if (error.message.includes("validation failed")) {
        errorMessage = "Invalid data provided";
      } else {
        errorMessage = error.message || errorMessage;
      }
      throw new Error(errorMessage);
    }
  }

  static async updateIsAccepteds(user, user_id) {
    try {
      const updateduser = await User.findByIdAndUpdate(
        user_id,
        { isAccepted: user.isAccepted },
        { new: true }
      );

      const mechanic = await Onboarding.findOne({
        user_id: updateduser._id,
      });

      await sendApprovalEmail(updateduser.email, updateduser.firstname);

      const role = await Role.findOne({ name: "Client" });
      if (updateduser.role_id.toString() === role._id.toString()) {
        const clientData = {
          client_id: updateduser._id ?? "",
          ai_name: updateduser.username ?? "",
          address: mechanic.companyDetails.officialAddress ?? "",
        };

        await sendNewClientrigger(clientData);
      }

      if (!updateduser) {
        throw new Error("User not found");
      }

      return updateduser;
    } catch (error) {
      console.error("Error in updateIsAccepteds:", error);
      throw error;
    }
  }

  static async listOnboarding(page = 0, limit = 10) {
    try {
      const options = {
        page,
        limit,
      };

      const onboardingList = await Onboarding.paginate({}, options);
      return onboardingList;
    } catch (error) {
      console.error("Exception in onboardingList:", error);
      throw error;
    }
  }

  static async getMyProfile() {
    try {
      const user = req.user;
      if (!user) {
        console.warn("No user found for username:");
        throw new Error("User not found");
      }
      return user;
    } catch (error) {
      console.error("Exception in getMyProfile", error);
      throw error;
    }
  }

  static async userUpdate(data) {
    const userPayload = data.body ?? data;
    const servicesRequested = data.user ?? data;
    // console.log( "____image______", data.files.image)
    const { profileImage } = data?.files?.image ?? data;
    try {
      const {
        email,
        firstname,
        lastname,
        phoneNumber,
        username,
        twoFactorEnabled,
        twilioNumber,
      } = userPayload;

      // console.log("userPayload", userPayload, "______----______", data.user)

      // Check for existing phone number
      const existingUserWithPhone = await User.findOne({
        username: { $ne: userPayload.username },
        phoneNumber: userPayload.phoneNumber,
      });

      if (existingUserWithPhone) {
        const otherPhone = existingUserWithPhone.phoneNumber;
        if (typeof otherPhone === "string" && otherPhone.trim() !== "") {
          if (otherPhone === userPayload.phoneNumber) {
            throw new Error("Mobile number already exists in another user.");
          }
        }
      }

      let groupName = servicesRequested.adminRole;
      // console.log(groupName)
      // Find role
      const role = await Role.findOne({ name: groupName });
      if (!role) {
        throw new Error(`Role ${groupName} not found`);
      }

      const updateData = {
        firstname: firstname,
        lastname: lastname,
        email,
        phoneNumber: phoneNumber,
        status: "Enabled",
        role_id: role._id,
        twoFactorEnabled,
        image: profileImage,
        twilioNumber: twilioNumber,
      };

      const updateUser = await User.findOneAndUpdate(
        { username },
        { $set: updateData },
        { new: true, upsert: true }
      );
      // console.log(updateUser, updateData, userPayload)
      if (!updateUser) {
        throw new Error("User not found");
      }

      // Update onboarding if servicesRequested is provided
      if (servicesRequested) {
        await Onboarding.findOneAndUpdate(
          { user_id: updateUser._id },
          { $set: { servicesRequested: servicesRequested } },
          { new: true }
        );
      }

      return {
        message: "User updated successfully",
        user: updateUser,
        servicesRequested: servicesRequested,
      };
    } catch (error) {
      console.error("Exception in userUpdate:", error);
      throw error;
    }
  }

  static async userDelete(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      await User.deleteOne({ _id: userId });
      return user;
    } catch (error) {
      console.error("Exception in userDelete:", error);
      throw error;
    }
  }

  static async updateUserSettings(data) {
    const userPayload = data?.payload?.user ?? data?.user ?? data;
    console.log(userPayload);
    try {
      const {
        username,
        twoFactorEnabled,
        preferences = {},
        notificationSettings = {},
      } = userPayload;

      const { language, theme, timezone } = preferences;

      const { email, sms, push } = notificationSettings;

      // Check for user
      const existingUser = await User.findOne({
        username: username,
      });
      if (!existingUser) {
        throw new Error("User doesn't exist.");
      }

      const updateData = {
        twoFactorEnabled,
        preferences: {
          language,
          timezone,
          theme,
        },
        notificationSettings: {
          email,
          sms,
          push,
        },
      };

      const updateUser = await User.findOneAndUpdate(
        { username },
        { $set: updateData },
        { new: true }
      );

      if (!updateUser) {
        throw new Error("User could not be updated");
      }

      if (updateUser.twoFactorEnabled) {
        const token = updateUser.generate2FAToken();
        const verificationLink = `${process.env.NEXT_PUBLIC_BASE_URL}/2FA/authentication/${token}`;
        await sendVerificationEmail(
          updateUser.email,
          updateUser.username,
          verificationLink
        );

        return {
          tokenMessage: "2FA is enabled✅. Please verify with your Mail.",
          message: "Settings Updated⚒✅",
          settings: updateUser,
          tempToken: token,
        };
      }

      return {
        message: "Settings Updated⚒✅",
        settings: updateUser,
      };
    } catch (error) {
      console.error("Exception in userUpdate:", error);
      throw error;
    }
  }
}

module.exports = UserService;
