const { HTTP_STATUS_CODES } = require("../helper");
const {
  sendForgotPasswordEmail,
} = require("../services/mail/forgotpasswordmail");
const Driver = require("../models/driver.model");
const Organization = require("../models/organization.model");
const Role = require("../models/role.model");
const DriverVerification = require("../models/driver-verification.model");
const DriverPortalSettings = require("../models/driver-portal-settings.model");
const { Payment, AIConfig } = require("../models");
const { createOrGetDriverPolicy } = require("./driver-policy.controller");
const StripeService = require("../services/stripe.service");
const smsService = require("../services/sms.service");
const crypto = require("crypto");
const AWS = require("aws-sdk");

// Initialize Stripe service
const stripeService = new StripeService();

// Configure AWS S3 for direct upload
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  region: process.env.AWS_S3_BUCKET_REGION,
});

// Validation helpers
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone) => {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, "").length >= 10;
};

const validateFullName = (fullName) => {
  return (
    fullName && fullName.trim().length >= 2 && fullName.trim().length <= 100
  );
};

// Register a new driver
exports.registerDriver = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      organizationSlug,
      plan,
    } = req.body;

    // Validation
    if (!firstName || !validateFullName(firstName)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "First name is required and must be between 2-100 characters",
      });
    }

    if (!lastName || !validateFullName(lastName)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Last name is required and must be between 2-100 characters",
      });
    }

    if (!email || !validateEmail(email)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Valid email is required",
      });
    }

    if (!phone || !validatePhone(phone)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Valid phone number is required",
      });
    }

    if (!password || password.length < 8) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Password is required and must be at least 8 characters long",
      });
    }

    if (!organizationSlug) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "organizationSlug is required",
      });
    }

    if (!plan || !["monthly", "payperuse"].includes(plan)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Plan must be either 'monthly' or 'payperuse'",
      });
    }

    // Check if driver already exists with this email
    const existingDriverByEmail = await Driver.findOne({
      email: email.toLowerCase(),
    });
    if (existingDriverByEmail) {
      return res.status(HTTP_STATUS_CODES.CONFLICT).json({
        success: false,
        message: "Driver with this email already exists",
      });
    }

    // Check if driver already exists with this phone number
    const existingDriverByPhone = await Driver.findOne({ phone });
    if (existingDriverByPhone) {
      return res.status(HTTP_STATUS_CODES.CONFLICT).json({
        success: false,
        message: "Driver with this phone number already exists",
      });
    }

    // Find organization by slug
    const organization = await Organization.findOne({
      urlSlug: organizationSlug,
    });
    if (!organization) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Organization not found with the provided company slug",
      });
    }

    // Find driver role
    let driverRole = await Role.findOne({ name: "driver" });
    if (!driverRole) {
      // Create driver role if it doesn't exist
      driverRole = new Role({
        name: "driver",
        description: "Driver role for accessing driver portal",
        permissions: [
          "access_driver_portal",
          "create_service_requests",
          "view_own_tickets",
        ],
        isActive: true,
      });
      await driverRole.save();
    }

    // Create new driver with provided password
    const newDriver = new Driver({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password, // Use provided password instead of generating temporary one
      organization: organization._id,
      role_id: driverRole._id,
      plan,
      status: "pending", // Will be activated after verification
    });

    // Generate registration token
    const registrationToken = newDriver.generateRegistrationToken();

    // Save driver
    await newDriver.save();

    // Send OTP SMS automatically after registration
    try {
      const otp = newDriver.generateOTP();
      await newDriver.save();

      const formattedPhone = smsService.formatPhoneNumber(phone);
      await smsService.sendOTP(formattedPhone, otp, `${firstName} ${lastName}`);

      console.log(`OTP sent to ${formattedPhone} for driver ${newDriver._id}`);
    } catch (smsError) {
      console.error("Failed to send OTP SMS:", smsError);
      // Don't fail registration if SMS fails, but log it
    }

    // Return success response
    return res.status(HTTP_STATUS_CODES.CREATED).json({
      success: true,
      data: {
        driverId: newDriver._id.toString(),
        registrationToken: registrationToken,
        message:
          "Driver registered successfully. OTP sent to your phone number.",
      },
    });
  } catch (error) {
    console.error("Driver registration error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error during registration",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Login driver
exports.loginDriver = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (!validateEmail(email)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Valid email is required",
      });
    }

    // Find driver and validate credentials
    const driver = await Driver.findByCredentials(
      email.toLowerCase(),
      password
    );

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Populate organization after finding the driver
    await driver.populate("organization");

    // Check if driver account exists but is not active
    if (driver.status !== "active" && driver.status !== "pending") {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        success: false,
        message: "Driver account is suspended. Please contact support.",
      });
    }

    // Update last login
    driver.lastLogin = new Date();
    await driver.save();

    // Check onboarding status
    let isOnboardingComplete = false;
    let currentStep = null;
    let completedSteps = [];
    let remainingSteps = [];

    // Step 1: Registration (always true if we reach here)
    completedSteps.push("registration");

    // Step 2: Phone verification
    if (!driver.phoneVerified) {
      isOnboardingComplete = false;
      currentStep = "phoneVerification";
      remainingSteps = [
        "phoneVerification",
        "paymentSetup",
        "documentVerification",
      ];
    } else {
      completedSteps.push("phoneVerification");

      // Step 3: Payment setup
      let paymentComplete = false;
      if (driver.plan === "payperuse") {
        paymentComplete = driver.payPerUseStatus === "paid";
      } else if (driver.plan === "monthly") {
        paymentComplete =
          driver.subscriptionStatus === "active" && driver.stripeSubscriptionId;
      }

      if (!paymentComplete) {
        isOnboardingComplete = false;
        currentStep = "paymentSetup";
        remainingSteps = ["paymentSetup", "documentVerification"];
      } else {
        completedSteps.push("paymentSetup");

        // Step 4: Document verification
        try {
          const verification = await DriverVerification.findOne({
            driverId: driver._id,
          });

          if (verification) {
            completedSteps.push("documentVerification");
            isOnboardingComplete = true;
          } else {
            isOnboardingComplete = false;
            currentStep = "documentVerification";
            remainingSteps = ["documentVerification"];
          }
        } catch (verificationError) {
          console.error(
            "Error checking verification during login:",
            verificationError
          );
          isOnboardingComplete = false;
          currentStep = "documentVerification";
          remainingSteps = ["documentVerification"];
        }
      }
    }

    if (isOnboardingComplete) {
      // Driver has completed onboarding - return regular token
      const token = driver.generateToken();

      return res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        data: {
          token,
          driver: {
            id: driver._id,
            firstName: driver.firstName,
            lastName: driver.lastName,
            email: driver.email,
            phone: driver.phone,
            plan: driver.plan,
            status: driver.status,
            organizationId: driver.organization._id,
            organizationName: driver.organization.companyName,
            phoneVerified: driver.phoneVerified,
            payPerUseStatus: driver.payPerUseStatus,
            subscriptionStatus: driver.subscriptionStatus,
            isVerified: driver.isVerified,
          },
          onboarding: {
            isComplete: true,
            completedSteps,
            currentStep: null,
            remainingSteps: [],
            progress: {
              completed: completedSteps.length,
              total: 4,
              percentage: 100,
            },
          },
          message: "Login successful",
        },
      });
    } else {
      // Driver has not completed onboarding - return registration token format
      const registrationToken = driver.generateRegistrationToken();

      // Send OTP SMS automatically for incomplete onboarding if phone not verified
      try {
        if (!driver.phoneVerified) {
          const otp = driver.generateOTP();
          await driver.save();

          const formattedPhone = smsService.formatPhoneNumber(driver.phone);
          await smsService.sendOTP(
            formattedPhone,
            otp,
            `${driver.firstName} ${driver.lastName}`
          );

          console.log(
            `OTP sent to ${formattedPhone} for driver ${driver._id} during login`
          );
        }
      } catch (smsError) {
        console.error("Failed to send OTP SMS during login:", smsError);
        // Don't fail login if SMS fails, but log it
      }

      // Prepare organization info for registration flow
      const organizationInfo = {
        id: driver.organization._id,
        companyName: driver.organization.companyName,
        urlSlug: driver.organization.urlSlug,
        organizationType: driver.organization.organization_type,
      };

      // Add logo if exists
      if (driver.organization.logo && driver.organization.logoContentType) {
        organizationInfo.logo = driver.organization.logo.toString("base64");
        organizationInfo.logoContentType = driver.organization.logoContentType;
      }

      // Get pricing settings
      try {
        const portalSettings = await DriverPortalSettings.findOne({
          organization_id: driver.organization._id,
        });

        if (portalSettings) {
          organizationInfo.settings = {
            customPricing: {
              monthly: portalSettings.subscriptionCost,
              payperuse: portalSettings.oneTimeCost,
            },
            allowedPlans: ["monthly", "payperuse"], // Default allowed plans
          };
        }
      } catch (settingsError) {
        console.error(
          "Error fetching portal settings during login:",
          settingsError
        );
        // Continue without pricing settings
      }

      // Prepare form data for frontend
      const formData = {
        firstName: driver.firstName,
        lastName: driver.lastName,
        email: driver.email,
        phone: driver.phone,
        company: driver.organization.companyName,
        plan: driver.plan,
      };

      // Calculate progress
      const progress = {
        completed: completedSteps.length,
        total: 4,
        percentage: Math.round((completedSteps.length / 4) * 100),
      };

      // Prepare registration data structure that frontend expects
      const registrationData = {
        driverId: driver._id.toString(),
        registrationToken: registrationToken,
        verificationId: null, // Will be set during verification process
        formData,
        organizationInfo,
        otpVerified: driver.phoneVerified,
        fromLogin: true, // Flag to indicate this came from login
        paymentCompleted: completedSteps.includes("paymentSetup"),
        documentsSubmitted: completedSteps.includes("documentVerification"),
      };

      return res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        data: {
          driverId: driver._id.toString(),
          registrationToken: registrationToken,
          onboardingIncomplete: true,
          onboarding: {
            isComplete: false,
            completedSteps,
            currentStep,
            remainingSteps,
            progress,
          },
          driver: {
            id: driver._id,
            firstName: driver.firstName,
            lastName: driver.lastName,
            email: driver.email,
            phone: driver.phone,
            plan: driver.plan,
            status: driver.status,
            organizationId: driver.organization._id,
            organizationName: driver.organization.companyName,
            phoneVerified: driver.phoneVerified,
            payPerUseStatus: driver.payPerUseStatus,
            subscriptionStatus: driver.subscriptionStatus,
            isVerified: driver.isVerified,
          },
          registrationData: registrationData, // Complete data structure for frontend
          redirectTo: {
            step: currentStep,
            url: `/register/${driver.organization.urlSlug}/${getStepPath(
              currentStep
            )}`,
          },
          message: driver.phoneVerified
            ? "Login successful. Please complete your onboarding process."
            : "Login successful. OTP sent to your phone number. Please complete your onboarding process.",
        },
      });
    }
  } catch (error) {
    console.error("Driver login error:", error);

    // Handle specific authentication errors
    if (
      error.message === "Driver not found" ||
      error.message === "Invalid password"
    ) {
      return res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error during login",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// send otp for reset password
exports.resetPass = async (req, res) => {
  const { email } = req.body;

  const driver = await Driver.findOne({ email });

  if (!driver) {
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
      success: false,
      message: "Driver not found",
    });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  driver.otp = otp;
  driver.otpExpires = otpExpires;
  await driver.save();
  await sendForgotPasswordEmail(email, otp);

  return res.status(HTTP_STATUS_CODES.OK).json({
    success: true,
    data: {
      driver,
      message: "Email sent successfully",
    },
  });
};

// check otp for reset password
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  const driver = await Driver.findOne({ email });

  if (!driver) {
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
      success: false,
      message: "Driver not found",
    });
  }

  if (driver.otp !== Number(otp)) {
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: "Invalid OTP",
    });
  }

  if (driver.otpExpires.getTime() < Date.now()) {
    return res.status(HTTP_STATUS_CODES.CONFLICT).json({
      success: false,
      message: "OTP has expired",
    });
  }

  return res.status(HTTP_STATUS_CODES.OK).json({
    success: true,
    message: "OTP Verified",
  });
};

// change password
exports.changePass = async (req, res) => {
  const { email, password } = req.body;

  const driver = await Driver.findOne({ email });

  if (!driver) {
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
      success: false,
      message: "Driver not found",
    });
  }

  if (driver.otpExpires.getTime() < Date.now()) {
    throw new Error("OTP has expired");
  }

  driver.password = password;
  driver.otp = null;
  driver.otpExpires = null;
  await driver.save();

  return res.status(HTTP_STATUS_CODES.OK).json({
    success: true,
    data: {
      driver,
      message: "Password changed successfully",
    },
  });
};

// Helper function to get step path for U`RL construction
function getStepPath(step) {
  const stepPaths = {
    registration: "",
    phoneVerification: "otp-verification",
    paymentSetup: "payment",
    documentVerification: "verification",
  };
  return stepPaths[step] || "";
}

// Get driver profile (example of protected route)
exports.getDriverProfile = async (req, res) => {
  try {
    const driver = await Driver.findById(req.driver.driverId)
      .populate("organization", "companyName urlSlug")
      .populate("role_id", "name description")
      .select("-password -registrationToken");

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: {
        driver,
        message: "Driver profile retrieved successfully",
      },
    });
  } catch (error) {
    console.error("Get driver profile error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Complete driver registration (example of registration token protected route)
exports.completeRegistration = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Password and confirm password are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    if (password.length < 8) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // Get driver from middleware
    const driver = await Driver.findById(req.driver.driverId);

    // Update password and activate account
    driver.password = password;
    driver.status = "active";
    driver.isVerified = true;

    await driver.save();

    // Generate regular token
    const token = driver.generateToken();

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: {
        token,
        message: "Registration completed successfully",
      },
    });
  } catch (error) {
    console.error("Complete registration error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update driver registration details (requires registration token)
exports.updateRegistrationDetails = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, plan } = req.body;

    // Get driver ID from registration token middleware
    const driverId = req.driver.driverId;

    // Find the existing driver
    const existingDriver = await Driver.findById(driverId);

    if (!existingDriver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Prepare update object and track changes
    const updateData = {};
    const updates = {};
    let emailChanged = false;
    let phoneChanged = false;

    // Validate and update first name
    if (firstName !== undefined) {
      if (!firstName || !validateFullName(firstName)) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message:
            "First name is required and must be between 2-100 characters",
        });
      }

      if (firstName !== existingDriver.firstName) {
        updateData.firstName = firstName;
        updates.firstName = firstName;
      }
    }

    // Validate and update last name
    if (lastName !== undefined) {
      if (!lastName || !validateFullName(lastName)) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Last name is required and must be between 2-100 characters",
        });
      }

      if (lastName !== existingDriver.lastName) {
        updateData.lastName = lastName;
        updates.lastName = lastName;
      }
    }

    if (plan !== existingDriver.plan) {
      updateData.plan = plan;
      updates.plan = plan;
    }

    // Validate and update email
    if (email !== undefined) {
      if (!email || !validateEmail(email)) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Valid email is required",
        });
      }

      const normalizedEmail = email.toLowerCase();

      if (normalizedEmail !== existingDriver.email.toLowerCase()) {
        // Check if new email is already in use by another driver
        const existingDriverByEmail = await Driver.findOne({
          email: normalizedEmail,
          _id: { $ne: driverId },
        });

        if (existingDriverByEmail) {
          return res.status(HTTP_STATUS_CODES.CONFLICT).json({
            success: false,
            message: "This email is already in use by another driver",
          });
        }

        updateData.email = normalizedEmail;
        updates.email = normalizedEmail;
        emailChanged = true;
      }
    }

    // Validate and update phone
    if (phone !== undefined) {
      if (!phone || !validatePhone(phone)) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Valid phone number is required",
        });
      }

      if (phone !== existingDriver.phone) {
        // Check if new phone number is already in use by another driver
        const existingDriverByPhone = await Driver.findOne({
          phone: phone,
          _id: { $ne: driverId },
        });

        if (existingDriverByPhone) {
          return res.status(HTTP_STATUS_CODES.CONFLICT).json({
            success: false,
            message: "This phone number is already in use by another driver",
          });
        }

        updateData.phone = phone;
        updates.phone = phone;
        phoneChanged = true;

        // Reset phone verification if phone changed
        updateData.phoneVerified = false;
        updateData.otp = undefined;
        updateData.otpExpires = undefined;
        updateData.otpAttempts = 0;
      }
    }

    // Check if any updates were made
    if (Object.keys(updateData).length === 0) {
      return res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        data: {
          message: "No changes detected. Registration details are up to date.",
          driver: {
            id: existingDriver._id,
            firstName: existingDriver.firstName,
            lastName: existingDriver.lastName,
            email: existingDriver.email,
            phone: existingDriver.phone,
            phoneVerified: existingDriver.phoneVerified,
            plan: existingDriver.plan,
          },
        },
      });
    }

    // Update the driver
    const updatedDriver = await Driver.findByIdAndUpdate(driverId, updateData, {
      new: true, // Return updated document
      runValidators: true, // Run schema validators
    }).select("-password -registrationToken");

    if (!updatedDriver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found during update",
      });
    }

    // Send OTP if phone was changed
    if (phoneChanged) {
      try {
        // Generate OTP for the updated driver
        const driverForOTP = await Driver.findById(driverId);
        const otp = driverForOTP.generateOTP();
        await driverForOTP.save();

        const formattedPhone = smsService.formatPhoneNumber(phone);
        await smsService.sendOTP(
          formattedPhone,
          otp,
          `${updatedDriver.firstName} ${updatedDriver.lastName}`
        );

        console.log(
          `OTP sent to new phone ${formattedPhone} for driver ${driverId} during registration update`
        );
      } catch (smsError) {
        console.error(
          "Failed to send OTP to new phone during registration update:",
          smsError
        );
        // Don't fail the update if SMS fails
      }
    }

    // Prepare response
    const responseData = {
      driver: {
        id: updatedDriver._id,
        firstName: updatedDriver.firstName,
        lastName: updatedDriver.lastName,
        email: updatedDriver.email,
        phone: updatedDriver.phone,
        phoneVerified: updatedDriver.phoneVerified,
        plan: updatedDriver.plan,
        status: updatedDriver.status,
      },
      updates: updates,
      phoneVerificationRequired: phoneChanged,
      emailChanged: emailChanged,
    };

    let message = "Registration details updated successfully";
    if (phoneChanged) {
      message += ". Please verify your new phone number with the OTP sent";
    }
    if (emailChanged) {
      message += ". Email updated successfully";
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: {
        ...responseData,
        message: message,
      },
    });
  } catch (error) {
    console.error("Update registration details error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update registration details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Submit driver verification documents
exports.submitVerification = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Validate that the driver exists and matches the token
    if (req.driver.driverId.toString() !== driverId) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        success: false,
        message: "You can only submit verification for your own account",
      });
    }

    // Check if files are uploaded
    if (
      !req.files ||
      !req.files.driverLicenseFront ||
      !req.files.driverLicenseBack
    ) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Both driver license front and back images are required",
      });
    }

    const frontFile = req.files.driverLicenseFront;
    const backFile = req.files.driverLicenseBack;

    // File validation
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
    ];
    const maxFileSize = 5 * 1024 * 1024; // 5MB in bytes

    // Validate front file
    if (!allowedMimeTypes.includes(frontFile.mimetype)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message:
          "Driver license front: Only JPG, PNG, and PDF files are allowed",
      });
    }

    if (frontFile.size > maxFileSize) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Driver license front: File size must be less than 5MB",
      });
    }

    // Validate back file
    if (!allowedMimeTypes.includes(backFile.mimetype)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message:
          "Driver license back: Only JPG, PNG, and PDF files are allowed",
      });
    }

    if (backFile.size > maxFileSize) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Driver license back: File size must be less than 5MB",
      });
    }

    try {
      // Generate unique file keys
      const frontFileKey = `driver-verification/${driverId}/front_${Date.now()}_${
        frontFile.name
      }`;
      const backFileKey = `driver-verification/${driverId}/back_${Date.now()}_${
        backFile.name
      }`;

      // Upload front file to S3 directly
      const frontFileUpload = await s3
        .upload({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: frontFileKey,
          Body: frontFile.data,
          ContentType: frontFile.mimetype,
          ACL: "bucket-owner-full-control",
        })
        .promise();

      // Upload back file to S3 directly
      const backFileUpload = await s3
        .upload({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: backFileKey,
          Body: backFile.data,
          ContentType: backFile.mimetype,
          ACL: "bucket-owner-full-control",
        })
        .promise();

      // Check if driver already has a verification record
      let verification = await DriverVerification.findOne({ driverId });

      if (verification) {
        // Update existing verification (resubmission)
        verification.status = "pending_review";
        verification.documents.driverLicenseFront = {
          filename: frontFileUpload.Key,
          originalName: frontFile.name,
          mimeType: frontFile.mimetype,
          size: frontFile.size,
          uploadDate: new Date(),
          s3Key: frontFileUpload.Key,
          s3Location: frontFileUpload.Location,
          s3Bucket: process.env.AWS_S3_BUCKET_NAME,
        };
        verification.documents.driverLicenseBack = {
          filename: backFileUpload.Key,
          originalName: backFile.name,
          mimeType: backFile.mimetype,
          size: backFile.size,
          uploadDate: new Date(),
          s3Key: backFileUpload.Key,
          s3Location: backFileUpload.Location,
          s3Bucket: process.env.AWS_S3_BUCKET_NAME,
        };
        verification.documentsReceived = ["front", "back"];
        verification.submissionCount += 1;
        verification.reviewedBy = undefined;
        verification.reviewedAt = undefined;
        verification.reviewNotes = undefined;
        verification.rejectionReason = undefined;
        verification.metadata = {
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get("User-Agent"),
          submissionSource: "driver_portal",
          uploadMethod: "aws_s3",
        };
      } else {
        // Create new verification record
        verification = new DriverVerification({
          driverId,
          organizationId: req.driver.organizationId,
          status: "pending_review",
          documents: {
            driverLicenseFront: {
              filename: frontFileUpload.Key,
              originalName: frontFile.name,
              mimeType: frontFile.mimetype,
              size: frontFile.size,
              uploadDate: new Date(),
              s3Key: frontFileUpload.Key,
              s3Location: frontFileUpload.Location,
              s3Bucket: process.env.AWS_S3_BUCKET_NAME,
            },
            driverLicenseBack: {
              filename: backFileUpload.Key,
              originalName: backFile.name,
              mimeType: backFile.mimetype,
              size: backFile.size,
              uploadDate: new Date(),
              s3Key: backFileUpload.Key,
              s3Location: backFileUpload.Location,
              s3Bucket: process.env.AWS_S3_BUCKET_NAME,
            },
          },
          documentsReceived: ["front", "back"],
          submissionCount: 1,
          metadata: {
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get("User-Agent"),
            submissionSource: "driver_portal",
            uploadMethod: "aws_s3",
          },
        });
      }

      await verification.save();

      return res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        data: {
          verificationId: verification._id.toString(),
          status: verification.status,
          documentsReceived: verification.documentsReceived,
          frontFileLocation: frontFileUpload.Location,
          backFileLocation: backFileUpload.Location,
          message: "Documents uploaded successfully to AWS S3",
        },
      });
    } catch (uploadError) {
      console.error("AWS S3 upload error:", uploadError);
      return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to upload documents to cloud storage",
        error:
          process.env.NODE_ENV === "development"
            ? uploadError.message
            : undefined,
      });
    }
  } catch (error) {
    console.error("Driver verification submission error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error during verification submission",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get organization information for driver portal
exports.getOrganizationInfo = async (req, res) => {
  try {
    const organizationId = req.driver.organizationId;

    if (!organizationId) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "No organization associated with this driver",
      });
    }

    // Get organization details
    const organization = await Organization.findById(organizationId).select(
      "companyName logo logoContentType companyWebsite urlSlug organization_type"
    );

    if (!organization) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Organization not found",
      });
    }

    const AI_Number = await AIConfig.findOne({
      organization_id: organizationId,
    });

    // Get driver portal settings for pricing information
    const portalSettings = await DriverPortalSettings.findOne({
      organization_id: organizationId,
    });

    // Prepare response data
    const organizationInfo = {
      id: organization._id,
      companyName: organization.companyName,
      companyWebsite: organization.companyWebsite,
      urlSlug: organization.urlSlug,
      organizationType: organization.organization_type,
      hasLogo: !!organization.logo,
      aiNumber: AI_Number?.number || null,
    };

    // Add pricing information if portal settings exist
    if (portalSettings) {
      organizationInfo.pricing = {
        monthly: {
          amount: portalSettings.subscriptionCost,
          currency: "usd",
          interval: "month",
        },
        payPerUse: {
          amount: portalSettings.oneTimeCost,
          currency: "usd",
        },
        serviceFee: {
          type: portalSettings.paymentType,
          value:
            portalSettings.paymentType === "percentage"
              ? portalSettings.percentageValue
              : portalSettings.flatFeeValue,
          formatted:
            portalSettings.paymentType === "percentage"
              ? `${portalSettings.percentageValue}% service fee`
              : `$${portalSettings.flatFeeValue} service fee`,
        },
        stripeConnected: portalSettings.stripeConnected || false,
      };
    }

    // If logo exists, add logo data
    if (organization.logo && organization.logoContentType) {
      organizationInfo.logo = {
        contentType: organization.logoContentType,
        data: organization.logo.toString("base64"),
      };
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: {
        organization: organizationInfo,
        message: "Organization information retrieved successfully",
      },
    });
  } catch (error) {
    console.error("Get organization info error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Alternative endpoint to get organization info by slug (public, no auth required)
exports.getOrganizationInfoBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Organization slug is required",
      });
    }

    // Get organization details by slug
    const organization = await Organization.findOne({ urlSlug: slug }).select(
      "companyName logo logoContentType companyWebsite urlSlug organization_type stripe_connect"
    );

    if (!organization) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Organization not found with the provided slug",
      });
    }

    // Get driver portal settings for pricing information
    const portalSettings = await DriverPortalSettings.findOne({
      organization_id: organization._id,
    });

    // Prepare response data
    const organizationInfo = {
      id: organization._id,
      companyName: organization.companyName,
      companyWebsite: organization.companyWebsite,
      urlSlug: organization.urlSlug,
      organizationType: organization.organization_type,
      hasLogo: !!organization.logo,
      hasStripe: !!organization.stripe_connect.account_id,
    };

    // Add pricing information if portal settings exist
    if (portalSettings) {
      organizationInfo.settings = {
        customPricing: {
          monthly: portalSettings.subscriptionCost,
          payperuse: portalSettings.oneTimeCost,
        },
      };
    }

    // If logo exists, add logo data
    if (organization.logo && organization.logoContentType) {
      organizationInfo.logo = {
        contentType: organization.logoContentType,
        data: organization.logo.toString("base64"),
      };
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: {
        organization: organizationInfo,
        message: "Organization information retrieved successfully",
      },
    });
  } catch (error) {
    console.error("Get organization info by slug error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Send OTP to driver's phone (requires registration token)
exports.sendOTP = async (req, res) => {
  try {
    const driver = await Driver.findById(req.driver.driverId);

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Check if phone is already verified
    if (driver.phoneVerified) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Phone number is already verified",
      });
    }

    // Rate limiting - check if too many attempts
    if (driver.otpAttempts >= 5) {
      return res.status(HTTP_STATUS_CODES.TOO_MANY_REQUESTS).json({
        success: false,
        message: "Too many OTP attempts. Please try again later.",
      });
    }

    // Check if OTP was sent recently (prevent spam)
    if (
      driver.otpExpires &&
      driver.otpExpires > new Date(Date.now() + 8 * 60 * 1000)
    ) {
      return res.status(HTTP_STATUS_CODES.TOO_MANY_REQUESTS).json({
        success: false,
        message:
          "OTP was sent recently. Please wait before requesting a new one.",
      });
    }

    // Generate and send new OTP
    const otp = driver.generateOTP();
    await driver.save();

    const formattedPhone = smsService.formatPhoneNumber(driver.phone);
    await smsService.sendOTP(
      formattedPhone,
      otp,
      `${driver.firstName} ${driver.lastName}`
    );

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: {
        message: "OTP sent successfully to your phone number",
        expiresIn: "10 minutes",
      },
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to send OTP",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Verify OTP (requires registration token)
exports.verifyOTP = async (req, res) => {
  try {
    const { otp } = req.body;

    if (!otp || otp.length !== 6) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Valid 6-digit OTP is required",
      });
    }

    const driver = await Driver.findById(req.driver.driverId);

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Check if phone is already verified
    if (driver.phoneVerified) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Phone number is already verified",
      });
    }

    // Check if too many failed attempts
    if (driver.otpAttempts >= 5) {
      return res.status(HTTP_STATUS_CODES.TOO_MANY_REQUESTS).json({
        success: false,
        message: "Too many failed OTP attempts. Please request a new OTP.",
      });
    }

    // Verify OTP
    const isValid = driver.verifyOTP(otp);
    await driver.save();

    if (!isValid) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Invalid or expired OTP",
        attemptsRemaining: Math.max(0, 5 - driver.otpAttempts),
      });
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: {
        message: "Phone number verified successfully",
        phoneVerified: true,
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to verify OTP",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get driver payment information and pricing
exports.getDriverPaymentInfo = async (req, res) => {
  try {
    const driver = await Driver.findById(req.driver.driverId).populate(
      "organization"
    );

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Get driver portal settings for the organization
    const portalSettings = await DriverPortalSettings.findOne({
      organization_id: driver.organization._id,
    });

    if (!portalSettings) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message:
          "Driver portal settings not configured for this organization. Please contact support.",
      });
    }

    // Check if organization has Stripe Connect enabled
    const organization = driver.organization;
    if (
      !organization.stripe_connect?.account_id ||
      !portalSettings.stripeConnected
    ) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message:
          "Payment processing is not available. Organization payment setup incomplete.",
      });
    }

    // Verify Stripe Connect account is active
    try {
      const canAcceptPayments = await stripeService.canAcceptPayments(
        organization.stripe_connect.account_id
      );

      if (!canAcceptPayments) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message:
            "Payment processing is temporarily unavailable. Please try again later.",
        });
      }
    } catch (stripeError) {
      console.error("Stripe account verification error:", stripeError);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Payment processing error. Please contact support.",
      });
    }

    // Calculate pricing based on driver's plan
    let pricing = {};

    if (driver.plan === "monthly") {
      pricing = {
        planType: "monthly",
        amount: portalSettings.subscriptionCost,
        description: "Monthly subscription fee",
        billingCycle: "monthly",
      };
    } else if (driver.plan === "payperuse") {
      pricing = {
        planType: "payperuse",
        amount: portalSettings.oneTimeCost,
        description: "Pay-per-use fee",
        billingCycle: "one-time",
      };
    }

    // Add service fee information if applicable
    if (portalSettings.paymentType === "percentage") {
      pricing.serviceFee = {
        type: "percentage",
        value: portalSettings.percentageValue,
        description: `${portalSettings.percentageValue}% service fee`,
      };
    } else if (portalSettings.paymentType === "flat") {
      pricing.serviceFee = {
        type: "flat",
        value: portalSettings.flatFeeValue,
        description: `$${portalSettings.flatFeeValue} service fee`,
      };
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: {
        pricing,
        organizationName: organization.companyName,
        canProceedWithPayment: true,
        message: "Payment information retrieved successfully",
      },
    });
  } catch (error) {
    console.error("Get driver payment info error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Create payment intent for driver
exports.createDriverPayment = async (req, res) => {
  try {
    const { paymentMethodId, savePaymentMethod = false } = req.body;

    if (!paymentMethodId) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Payment method is required",
      });
    }

    const driver = await Driver.findById(req.driver.driverId).populate(
      "organization"
    );

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Get driver portal settings
    const portalSettings = await DriverPortalSettings.findOne({
      organization_id: driver.organization._id,
    });

    if (!portalSettings || !portalSettings.stripeConnected) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Payment processing not available",
      });
    }

    // Calculate total amount based on driver's plan
    let baseAmount = 0;
    let description = "";

    if (driver.plan === "monthly") {
      baseAmount = portalSettings.subscriptionCost;
      description = `Monthly subscription - ${driver.organization.companyName}`;
    } else if (driver.plan === "payperuse") {
      baseAmount = portalSettings.oneTimeCost;
      description = `Pay-per-use fee - ${driver.organization.companyName}`;
    }

    // Calculate application fee (our service fee)
    let applicationFeeAmount = 0;
    if (portalSettings.paymentType === "percentage") {
      applicationFeeAmount =
        (baseAmount * portalSettings.percentageValue) / 100;
    } else if (portalSettings.paymentType === "flat") {
      applicationFeeAmount = portalSettings.flatFeeValue;
    }

    // Create payment intent
    const paymentData = {
      amount: baseAmount,
      currency: "usd",
      mechanicAccountId: driver.organization.stripe_connect.account_id,
      applicationFeeAmount,
      description,
      metadata: {
        driverId: driver._id.toString(),
        organizationId: driver.organization._id.toString(),
        plan: driver.plan,
        driverEmail: driver.email,
        driverName: `${driver.firstName} ${driver.lastName}`,
      },
    };

    const paymentIntent = await stripeService.createPaymentIntent(paymentData);

    // Save payment record
    const payment = new Payment({
      paymentIntentId: paymentIntent.id,
      amount: baseAmount,
      applicationFeeAmount,
      currency: "usd",
      status: "pending",
      userId: driver._id,
      userType: "driver",
      organizationId: driver.organization._id,
      description,
      metadata: {
        plan: driver.plan,
        portalSettingsId: portalSettings._id,
      },
    });

    await payment.save();

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: baseAmount,
        applicationFee: applicationFeeAmount,
        description,
        message: "Payment intent created successfully",
      },
    });
  } catch (error) {
    console.error("Create driver payment error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to create payment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get driver payment history
exports.getDriverPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const payments = await Payment.find({
      userId: req.driver.driverId,
      userType: "driver",
    })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("organizationId", "companyName");

    const total = await Payment.countDocuments({
      userId: req.driver.driverId,
      userType: "driver",
    });

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalPayments: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
        message: "Payment history retrieved successfully",
      },
    });
  } catch (error) {
    console.error("Get driver payment history error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to retrieve payment history",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Add payment method for driver
exports.addPaymentMethod = async (req, res) => {
  try {
    const driver = await Driver.findById(req.driver.driverId).populate(
      "organization"
    );

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Check organization's Stripe Connect status
    const organization = driver.organization;
    if (!organization.stripe_connect?.account_id) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Organization Stripe Connect account not set up",
      });
    }

    // Get driver portal settings for pricing (needed for pay-per-use)
    const portalSettings = await DriverPortalSettings.findOne({
      organization_id: driver.organization._id,
    });

    if (!portalSettings) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver portal settings not found for this organization",
      });
    }

    // Get or create Stripe customer on the organization's connected account
    let stripeCustomerId = driver.stripe_customer_id;

    if (!stripeCustomerId) {
      try {
        // Create customer on the organization's connected account
        const stripeCustomer = await stripeService.stripe.customers.create(
          {
            email: driver.email,
            name: `${driver.firstName} ${driver.lastName}`,
            phone: driver.phone,
            metadata: {
              driverId: driver._id.toString(),
              organizationId: driver.organization._id.toString(),
              userType: "driver",
            },
          },
          {
            stripeAccount: organization.stripe_connect.account_id, // Use organization's account
          }
        );

        stripeCustomerId = stripeCustomer.id;

        // Update driver with Stripe customer ID
        driver.stripe_customer_id = stripeCustomerId;
        await driver.save();
      } catch (stripeError) {
        console.error("Error creating Stripe customer:", stripeError);
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Failed to create customer account",
          error: stripeError.message,
        });
      }
    }

    try {
      let sessionConfig;
      let successUrl;
      let cancelUrl;

      // Determine URLs based on plan type
      if (driver.plan === "payperuse") {
        // Pay-per-use users get redirected to registration flow with session_id
        successUrl = `${process.env.DRIVER_FRONTEND_URL}/register/${organization.urlSlug}/payment?session_id={CHECKOUT_SESSION_ID}`;
        cancelUrl = `${process.env.DRIVER_FRONTEND_URL}/register/${organization.urlSlug}/payment?setup=cancelled`;
      } else {
        // Monthly users use different URLs
        successUrl = `${process.env.DRIVER_FRONTEND_URL}/register/${organization.urlSlug}/payment?session_id={CHECKOUT_SESSION_ID}`;
        cancelUrl = `${process.env.DRIVER_FRONTEND_URL}/register/${organization.urlSlug}/payment?setup=cancelled`;
      }

      // Both pay-per-use and monthly subscription drivers use setup mode
      // Pay-per-use drivers will not be charged until they actually use the service
      sessionConfig = {
        customer: stripeCustomerId,
        mode: "setup",
        currency: "usd",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          driverId: driver._id.toString(),
          organizationId: driver.organization._id.toString(),
          purpose: "add_payment_method",
          plan: driver.plan,
          orgSlug: organization.urlSlug,
        },
      };

      const session = await stripeService.stripe.checkout.sessions.create(
        sessionConfig,
        {
          stripeAccount: organization.stripe_connect.account_id, // Use organization's account
        }
      );

      return res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        data: {
          checkoutUrl: session.url,
          sessionId: session.id,
          customerId: stripeCustomerId,
          organizationAccountId: organization.stripe_connect.account_id,
          plan: driver.plan,
          mode: sessionConfig.mode,
          amount: null, // No charge for adding payment method
          successUrl: successUrl,
          cancelUrl: cancelUrl,
          message:
            driver.plan === "payperuse"
              ? "Payment method setup session created. No charges will be applied until you use the service."
              : "Payment method setup session created. You'll be able to create your subscription after adding your payment method.",
        },
      });
    } catch (stripeError) {
      console.error("Error creating checkout session:", stripeError);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Failed to create checkout session",
        error: stripeError.message,
      });
    }
  } catch (error) {
    console.error("Add payment method error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to create checkout session for payment method",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Handle checkout session completion
exports.handleCheckoutSuccess = async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Session ID is required",
      });
    }

    const driver = await Driver.findById(req.driver.driverId).populate(
      "organization"
    );

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    const organization = driver.organization;
    if (!organization.stripe_connect?.account_id) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Organization Stripe Connect account not set up",
      });
    }

    try {
      // Retrieve the checkout session from Stripe
      const session = await stripeService.stripe.checkout.sessions.retrieve(
        session_id,
        {
          expand: ["subscription", "payment_intent", "setup_intent"],
        },
        {
          stripeAccount: organization.stripe_connect.account_id,
        }
      );

      // Handle different session modes
      if (session.mode === "setup") {
        // Payment method setup completed
        if (
          session.setup_intent &&
          session.setup_intent.status === "succeeded"
        ) {
          // Get the payment method that was set up
          const paymentMethodId = session.setup_intent.payment_method;

          // Update driver's default payment method if this is their first one
          if (!driver.defaultPaymentMethodId) {
            driver.defaultPaymentMethodId = paymentMethodId;
          }

          // For pay-per-use drivers, they now have access until their card expires
          if (driver.plan === "payperuse") {
            // Set them to "paid" status when they add a card (no actual payment needed)
            driver.payPerUseStatus = "paid";

            // Get the card expiration date from the payment method
            try {
              const paymentMethod =
                await stripeService.stripe.paymentMethods.retrieve(
                  paymentMethodId,
                  {},
                  {
                    stripeAccount: organization.stripe_connect.account_id,
                  }
                );

              if (
                paymentMethod.card &&
                paymentMethod.card.exp_month &&
                paymentMethod.card.exp_year
              ) {
                // Set expiry date to the last day of the card's expiration month
                const cardExpMonth = paymentMethod.card.exp_month;
                const cardExpYear = paymentMethod.card.exp_year;
                const lastDayOfMonth = new Date(cardExpYear, cardExpMonth, 0); // Day 0 gets last day of previous month
                driver.payPerUseExpiryDate = lastDayOfMonth;
              } else {
                // Fallback to 1 year if card details not available
                driver.payPerUseExpiryDate = new Date(
                  Date.now() + 365 * 24 * 60 * 60 * 1000
                ); // 365 days
              }
            } catch (paymentMethodError) {
              console.error(
                "Error retrieving payment method details:",
                paymentMethodError
              );
              // Fallback to 1 year if error occurs
              driver.payPerUseExpiryDate = new Date(
                Date.now() + 365 * 24 * 60 * 60 * 1000
              ); // 365 days
            }

            driver.lastPaymentDate = new Date();

            // Create or get policy for driver after successful card setup for payperuse
            try {
              await createOrGetDriverPolicy(driver);
              console.log(
                `Policy created/verified for driver ${driver._id} with phone ${driver.phone} after successful pay-per-use card setup`
              );
            } catch (policyError) {
              console.error(
                "Error creating driver policy after card setup:",
                policyError
              );
              // Don't fail the payment success response if policy creation fails
              // Policy will be created when driver tries to access policy endpoints
            }

            await driver.save();

            // For pay-per-use drivers, return success with dashboard redirect info
            return res.status(HTTP_STATUS_CODES.OK).json({
              success: true,
              data: {
                sessionId: session_id,
                mode: session.mode,
                status: session.setup_intent.status,
                paymentMethodId: paymentMethodId,
                customerId: session.customer,
                payPerUseStatus: driver.payPerUseStatus,
                expiryDate: driver.payPerUseExpiryDate,
                message:
                  "Payment method added successfully. You now have access to the service until your card expires.",
                nextStep: "redirect_to_dashboard", // This tells frontend to redirect to dashboard
                dashboardUrl: "/dashboard", // Frontend can use this
              },
            });
          } else {
            // For monthly subscription drivers
            await driver.save();

            return res.status(HTTP_STATUS_CODES.OK).json({
              success: true,
              data: {
                sessionId: session_id,
                mode: session.mode,
                status: session.setup_intent.status,
                paymentMethodId: paymentMethodId,
                customerId: session.customer,
                message: "Payment method added successfully",
                nextStep: "create_subscription", // This tells frontend to show subscription creation
              },
            });
          }
        } else {
          return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: "Payment method setup was not successful",
            status: session.setup_intent?.status,
          });
        }
      }

      if (session.mode === "payment") {
        // One-time payment (pay-per-use) completed
        if (session.payment_status === "paid" && session.payment_intent?.id) {
          // Update driver pay-per-use status
          driver.payPerUseStatus = "paid";

          // Get the card expiration date from the payment method
          let cardExpiryDate = null;
          try {
            // Get payment intent to access the payment method
            const paymentIntent =
              await stripeService.stripe.paymentIntents.retrieve(
                session.payment_intent.id,
                {},
                {
                  stripeAccount: organization.stripe_connect.account_id,
                }
              );

            if (paymentIntent.payment_method) {
              const paymentMethod =
                await stripeService.stripe.paymentMethods.retrieve(
                  paymentIntent.payment_method,
                  {},
                  {
                    stripeAccount: organization.stripe_connect.account_id,
                  }
                );

              if (
                paymentMethod.card &&
                paymentMethod.card.exp_month &&
                paymentMethod.card.exp_year
              ) {
                // Set expiry date to the last day of the card's expiration month
                const cardExpMonth = paymentMethod.card.exp_month;
                const cardExpYear = paymentMethod.card.exp_year;
                cardExpiryDate = new Date(cardExpYear, cardExpMonth, 0); // Day 0 gets last day of previous month
              }
            }
          } catch (paymentMethodError) {
            console.error(
              "Error retrieving payment method details for payment mode:",
              paymentMethodError
            );
          }

          // Set expiry date (use card expiry or fallback to 1 year)
          driver.payPerUseExpiryDate =
            cardExpiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // Fallback to 1 year if card details not available

          driver.lastPaymentDate = new Date();

          // Extract payment details
          const paymentAmount = session.amount_total / 100; // Convert from cents to dollars

          // Create payment record for pay-per-use (we have payment_intent)
          const paymentData = {
            paymentIntentId: session.payment_intent.id,
            amount: paymentAmount,
            applicationFeeAmount: 0, // No application fee for direct connected account
            currency: session.currency || "usd",
            status: "completed",
            userId: driver._id,
            userType: "driver",
            organizationId: organization._id,
            description: `Pay-per-use access - ${organization.companyName}`,
            metadata: {
              plan: driver.plan,
              type: "payperuse_access",
              sessionId: session_id,
              stripeCustomerId: session.customer,
              accessDuration: "until card expires",
              expiryDate: driver.payPerUseExpiryDate,
              organizationAccountId: organization.stripe_connect.account_id,
            },
          };

          // Update existing payment or create new one
          await Payment.findOneAndUpdate(
            { paymentIntentId: session.payment_intent.id },
            paymentData,
            {
              new: true,
              upsert: true, // Create if doesn't exist
              setDefaultsOnInsert: true,
            }
          );

          await driver.save();

          // Create or get policy for driver after successful payment
          try {
            await createOrGetDriverPolicy(driver);
            console.log(
              `Policy created/verified for driver ${driver._id} with phone ${driver.phone} after successful pay-per-use payment`
            );
          } catch (policyError) {
            console.error(
              "Error creating driver policy after payment:",
              policyError
            );
            // Don't fail the payment success response if policy creation fails
            // Policy will be created when driver tries to access policy endpoints
          }

          return res.status(HTTP_STATUS_CODES.OK).json({
            success: true,
            data: {
              sessionId: session_id,
              paymentStatus: session.payment_status,
              mode: session.mode,
              payPerUseStatus: driver.payPerUseStatus,
              expiryDate: driver.payPerUseExpiryDate,
              amount: paymentAmount,
              currency: session.currency,
              accessDuration: "until card expires",
              customerId: session.customer,
              paymentId: session.payment_intent.id,
              serviceNumber: driver._id.toString().slice(-6).toUpperCase(), // Generate service number
              message:
                "Pay-per-use payment processed successfully. Access activated until card expires.",
            },
          });
        } else {
          return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: "Payment was not successful or payment intent missing",
            paymentStatus: session.payment_status,
          });
        }
      }

      if (session.mode === "subscription") {
        // Subscription creation completed
        if (session.payment_status === "paid" && session.subscription) {
          // Handle subscription creation
          driver.stripeSubscriptionId = session.subscription.id;
          driver.subscriptionStatus = session.subscription.status;
          driver.subscriptionStartDate = new Date();

          // Extract payment details from subscription
          const subscriptionAmount = session.amount_total / 100; // Convert from cents to dollars
          const subscriptionPlan =
            session.subscription.plan ||
            session.subscription.items?.data?.[0]?.price;

          // Get the invoice for payment intent ID
          let paymentIntentId = null;
          if (session.invoice) {
            paymentIntentId = session.invoice;
          } else if (session.subscription.latest_invoice) {
            paymentIntentId = session.subscription.latest_invoice;
          }

          // Calculate next billing date
          let nextBillingDate = null;
          if (session.subscription.billing_cycle_anchor) {
            nextBillingDate = new Date(
              session.subscription.billing_cycle_anchor * 1000
            );
          } else if (session.subscription.current_period_end) {
            nextBillingDate = new Date(
              session.subscription.current_period_end * 1000
            );
          }

          // Only create payment record if we have a valid payment intent ID
          if (paymentIntentId && paymentIntentId !== null) {
            // Create payment record for subscription
            const paymentData = {
              paymentIntentId: paymentIntentId,
              amount: subscriptionAmount,
              applicationFeeAmount: 0, // No application fee for direct connected account
              currency: session.currency || "usd",
              status: "completed",
              userId: driver._id,
              userType: "driver",
              organizationId: organization._id,
              description: `Monthly subscription - ${organization.companyName}`,
              metadata: {
                plan: driver.plan,
                type: "subscription",
                sessionId: session_id,
                subscriptionId: session.subscription.id,
                stripeCustomerId: session.customer,
                billingCycleAnchor: session.subscription.billing_cycle_anchor,
                subscriptionPlanId: subscriptionPlan?.id,
                subscriptionInterval: subscriptionPlan?.interval,
                organizationAccountId: organization.stripe_connect.account_id,
              },
            };

            // Update existing payment or create new one
            await Payment.findOneAndUpdate(
              { paymentIntentId: paymentIntentId },
              paymentData,
              {
                new: true,
                upsert: true, // Create if doesn't exist
                setDefaultsOnInsert: true,
              }
            );
          }

          await driver.save();

          // Create or get policy for driver after successful subscription
          try {
            await createOrGetDriverPolicy(driver);
            console.log(
              `Policy created/verified for driver ${driver._id} with phone ${driver.phone} after successful subscription creation`
            );
          } catch (policyError) {
            console.error(
              "Error creating driver policy after subscription:",
              policyError
            );
            // Don't fail the payment success response if policy creation fails
            // Policy will be created when driver tries to access policy endpoints
          }

          return res.status(HTTP_STATUS_CODES.OK).json({
            success: true,
            data: {
              sessionId: session_id,
              paymentStatus: session.payment_status,
              mode: session.mode,
              subscriptionId: driver.stripeSubscriptionId,
              subscriptionStatus: driver.subscriptionStatus,
              amount: subscriptionAmount,
              currency: session.currency,
              billingCycle: subscriptionPlan?.interval || "month",
              nextBillingDate: nextBillingDate,
              customerId: session.customer,
              paymentId: paymentIntentId,
              subscriptionId: session.subscription.id,
              serviceNumber: driver._id.toString().slice(-6).toUpperCase(), // Generate service number
              planId: subscriptionPlan?.id,
              message: "Monthly subscription created successfully",
            },
          });
        } else {
          return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
            success: false,
            message: "Subscription creation was not successful",
            paymentStatus: session.payment_status,
          });
        }
      }

      // Unknown session mode
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: `Unknown session mode: ${session.mode}`,
      });
    } catch (stripeError) {
      console.error("Error retrieving checkout session:", stripeError);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Failed to retrieve checkout session",
        error: stripeError.message,
      });
    }
  } catch (error) {
    console.error("Handle checkout success error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to process checkout success",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Create subscription to organization
exports.createSubscription = async (req, res) => {
  try {
    const driver = await Driver.findById(req.driver.driverId).populate(
      "organization"
    );

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Only allow monthly subscription plans for this endpoint
    if (driver.plan !== "monthly") {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message:
          "This endpoint is only for monthly subscription plans. Pay-per-use drivers should use the add payment method endpoint.",
      });
    }

    // Check if driver already has an active subscription
    if (driver.subscriptionStatus === "active") {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Driver already has an active subscription",
      });
    }

    // Get driver portal settings for pricing
    const portalSettings = await DriverPortalSettings.findOne({
      organization_id: driver.organization._id,
    });

    if (!portalSettings) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver portal settings not found for this organization",
      });
    }

    // Check organization's Stripe Connect status
    const organization = driver.organization;
    if (!organization.stripe_connect?.account_id) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Organization payment processing is not set up",
      });
    }

    // Verify Stripe Connect account can accept payments
    const canAcceptPayments = await stripeService.canAcceptPayments(
      organization.stripe_connect.account_id
    );

    if (!canAcceptPayments) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Organization cannot accept payments at this time",
      });
    }

    // Check if driver has a payment method saved
    if (!driver.stripe_customer_id) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message:
          "Driver must add a payment method first before creating a subscription",
        redirectTo: "add_payment_method",
      });
    }

    // Verify customer has payment methods
    try {
      const paymentMethods = await stripeService.stripe.paymentMethods.list(
        {
          customer: driver.stripe_customer_id,
          type: "card",
        },
        {
          stripeAccount: organization.stripe_connect.account_id,
        }
      );

      if (paymentMethods.data.length === 0) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message:
            "Driver must add a payment method first before creating a subscription",
          redirectTo: "add_payment_method",
        });
      }
    } catch (stripeError) {
      console.error("Error checking payment methods:", stripeError);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Unable to verify payment methods. Please try again.",
      });
    }

    // Calculate subscription details
    const subscriptionAmount = portalSettings.subscriptionCost;
    const description = `Monthly subscription - ${organization.companyName}`;

    // Calculate application fee (platform commission)
    let applicationFeeAmount = 0;
    if (portalSettings.paymentType === "percentage") {
      applicationFeeAmount = Math.round(
        ((subscriptionAmount * portalSettings.percentageValue) / 100) * 100
      ); // Convert to cents
    } else if (portalSettings.paymentType === "flat") {
      applicationFeeAmount = Math.round(portalSettings.flatFeeValue * 100); // Convert to cents
    }

    try {
      // Create Stripe Checkout session for subscription
      const sessionConfig = {
        customer: driver.stripe_customer_id,
        mode: "subscription",
        currency: "usd",
        success_url: `${process.env.DRIVER_FRONTEND_URL}/driver/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.DRIVER_FRONTEND_URL}/driver/subscription/cancel`,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${organization.companyName} Driver Subscription`,
                description: description,
              },
              unit_amount: Math.round(subscriptionAmount * 100), // Convert to cents
              recurring: {
                interval: "month",
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          driverId: driver._id.toString(),
          organizationId: organization._id.toString(),
          plan: driver.plan,
          portalSettingsId: portalSettings._id.toString(),
        },
      };

      const session = await stripeService.stripe.checkout.sessions.create(
        sessionConfig,
        {
          stripeAccount: organization.stripe_connect.account_id, // Use organization's account
        }
      );

      return res.status(HTTP_STATUS_CODES.CREATED).json({
        success: true,
        data: {
          checkoutUrl: session.url,
          sessionId: session.id,
          mode: "subscription",
          amount: subscriptionAmount,
          applicationFee: applicationFeeAmount / 100, // Convert back to dollars for response
          description: description,
          organizationAccountId: organization.stripe_connect.account_id,
          successUrl: `${process.env.DRIVER_FRONTEND_URL}/driver/subscription/success?session_id=${session.id}`,
          cancelUrl: `${process.env.DRIVER_FRONTEND_URL}/driver/subscription/cancel`,
          message:
            "Subscription checkout session created successfully. Redirect user to checkoutUrl.",
        },
      });
    } catch (stripeError) {
      console.error("Stripe checkout session creation error:", stripeError);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Failed to create checkout session with Stripe",
        error: stripeError.message,
      });
    }
  } catch (error) {
    console.error("Create subscription error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to create subscription checkout",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get driver's payment methods
exports.getPaymentMethods = async (req, res) => {
  try {
    const driver = await Driver.findById(req.driver.driverId).populate(
      "organization"
    );

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Check organization's Stripe Connect status
    const organization = driver.organization;
    if (!organization.stripe_connect?.account_id) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Organization Stripe Connect account not set up",
      });
    }

    if (!driver.stripe_customer_id) {
      return res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        data: {
          paymentMethods: [],
          message: "No payment methods found",
        },
      });
    }

    try {
      // Get payment methods from Stripe using organization's account
      const paymentMethods = await stripeService.stripe.paymentMethods.list(
        {
          customer: driver.stripe_customer_id,
          type: "card",
        },
        {
          stripeAccount: organization.stripe_connect.account_id, // Use organization's account
        }
      );

      const formattedPaymentMethods = paymentMethods.data.map((pm) => ({
        id: pm.id,
        type: pm.type,
        card: {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        },
        isDefault: pm.id === driver.defaultPaymentMethodId,
      }));

      return res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        data: {
          paymentMethods: formattedPaymentMethods,
          organizationAccountId: organization.stripe_connect.account_id,
          message: "Payment methods retrieved successfully",
        },
      });
    } catch (stripeError) {
      console.error("Stripe get payment methods error:", stripeError);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Failed to retrieve payment methods from Stripe",
        error: stripeError.message,
      });
    }
  } catch (error) {
    console.error("Get payment methods error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to retrieve payment methods",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get driver's subscription status and pricing
exports.getSubscriptionStatus = async (req, res) => {
  try {
    const driver = await Driver.findById(req.driver.driverId).populate(
      "organization"
    );

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Get driver portal settings for pricing information
    const portalSettings = await DriverPortalSettings.findOne({
      organization_id: driver.organization._id,
    });

    if (!portalSettings) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver portal settings not found for this organization",
      });
    }

    const response = {
      subscriptionStatus: driver.subscriptionStatus,
      plan: driver.plan,
      organizationName: driver.organization.companyName,
      pricing: {},
      subscription: null,
      payPerUse: null,
    };

    // Add pricing information
    response.pricing = {
      monthly: {
        amount: portalSettings.subscriptionCost,
        currency: "usd",
        interval: "month",
      },
      payPerUse: {
        amount: portalSettings.oneTimeCost,
        currency: "usd",
      },
      serviceFee: {
        type: portalSettings.paymentType,
        value:
          portalSettings.paymentType === "percentage"
            ? portalSettings.percentageValue
            : portalSettings.flatFeeValue,
      },
    };

    // Get subscription details if active
    if (driver.stripeSubscriptionId) {
      try {
        const subscription = await stripeService.stripe.subscriptions.retrieve(
          driver.stripeSubscriptionId,
          {}, // No additional parameters needed for retrieve
          {
            stripeAccount: driver.organization.stripe_connect.account_id, // Use organization's account
          }
        );

        response.subscription = {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: new Date(
            subscription.current_period_start * 1000
          ),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          amount: subscription.items.data[0]?.price?.unit_amount / 100,
          organizationAccountId: driver.organization.stripe_connect.account_id,
        };
      } catch (stripeError) {
        console.error(
          "Error retrieving subscription from Stripe:",
          stripeError
        );
      }
    }

    // Add pay-per-use status if applicable
    if (driver.plan === "payperuse") {
      response.payPerUse = {
        status: driver.payPerUseStatus,
        lastPaymentDate: driver.lastPaymentDate,
        expiryDate: driver.payPerUseExpiryDate,
      };
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Get subscription status error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to retrieve subscription status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Cancel driver's subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const { cancelImmediately = false } = req.body;

    const driver = await Driver.findById(req.driver.driverId);

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    if (!driver.stripeSubscriptionId) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "No active subscription found",
      });
    }

    try {
      let cancelledSubscription;

      if (cancelImmediately) {
        // Cancel immediately
        cancelledSubscription = await stripeService.stripe.subscriptions.cancel(
          driver.stripeSubscriptionId,
          {}, // No additional parameters needed for cancel
          {
            stripeAccount: driver.organization.stripe_connect.account_id, // Use organization's account
          }
        );
      } else {
        // Cancel at period end
        cancelledSubscription = await stripeService.stripe.subscriptions.update(
          driver.stripeSubscriptionId,
          { cancel_at_period_end: true },
          {
            stripeAccount: driver.organization.stripe_connect.account_id, // Use organization's account
          }
        );
      }

      // Update driver subscription status
      driver.subscriptionStatus = cancelledSubscription.status;
      if (cancelImmediately) {
        driver.subscriptionEndDate = new Date();
      }
      await driver.save();

      return res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        data: {
          subscriptionId: cancelledSubscription.id,
          status: cancelledSubscription.status,
          cancelAtPeriodEnd: cancelledSubscription.cancel_at_period_end,
          currentPeriodEnd: new Date(
            cancelledSubscription.current_period_end * 1000
          ),
          organizationAccountId: driver.organization.stripe_connect.account_id,
          message: cancelImmediately
            ? "Subscription cancelled immediately"
            : "Subscription will cancel at the end of current billing period",
        },
      });
    } catch (stripeError) {
      console.error("Stripe cancel subscription error:", stripeError);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Failed to cancel subscription with Stripe",
        error: stripeError.message,
      });
    }
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to cancel subscription",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get driver verification documents with signed URLs
exports.getVerificationDocuments = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Validate that the driver exists and matches the token
    if (req.driver.driverId.toString() !== driverId) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        success: false,
        message:
          "You can only access verification documents for your own account",
      });
    }

    // Find verification record
    const verification = await DriverVerification.findOne({ driverId });

    if (!verification) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "No verification documents found",
      });
    }

    // Import generatePresignedUrl function
    const { generatePresignedUrl } = require("../services/file-upload.service");

    try {
      const documents = {};

      // Generate signed URLs for front document if exists
      if (verification.documents.driverLicenseFront?.s3Key) {
        const frontSignedUrl = await generatePresignedUrl(
          verification.documents.driverLicenseFront.s3Key,
          3600 // 1 hour expiry
        );

        documents.driverLicenseFront = {
          originalName: verification.documents.driverLicenseFront.originalName,
          mimeType: verification.documents.driverLicenseFront.mimeType,
          size: verification.documents.driverLicenseFront.size,
          uploadDate: verification.documents.driverLicenseFront.uploadDate,
          signedUrl: frontSignedUrl,
          expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
        };
      }

      // Generate signed URLs for back document if exists
      if (verification.documents.driverLicenseBack?.s3Key) {
        const backSignedUrl = await generatePresignedUrl(
          verification.documents.driverLicenseBack.s3Key,
          3600 // 1 hour expiry
        );

        documents.driverLicenseBack = {
          originalName: verification.documents.driverLicenseBack.originalName,
          mimeType: verification.documents.driverLicenseBack.mimeType,
          size: verification.documents.driverLicenseBack.size,
          uploadDate: verification.documents.driverLicenseBack.uploadDate,
          signedUrl: backSignedUrl,
          expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour from now
        };
      }

      return res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        data: {
          verificationId: verification._id.toString(),
          status: verification.status,
          submissionCount: verification.submissionCount,
          documentsReceived: verification.documentsReceived,
          documents: documents,
          reviewedBy: verification.reviewedBy,
          reviewedAt: verification.reviewedAt,
          reviewNotes: verification.reviewNotes,
          rejectionReason: verification.rejectionReason,
          message: "Verification documents retrieved successfully",
        },
      });
    } catch (s3Error) {
      console.error("S3 signed URL generation error:", s3Error);
      return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to generate document access URLs",
        error:
          process.env.NODE_ENV === "development" ? s3Error.message : undefined,
      });
    }
  } catch (error) {
    console.error("Get verification documents error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get driver verification status
exports.getVerificationStatus = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Validate that the driver exists and matches the token
    if (req.driver.driverId.toString() !== driverId) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        success: false,
        message: "You can only access verification status for your own account",
      });
    }

    // Find verification record
    const verification = await DriverVerification.findOne({ driverId });

    if (!verification) {
      return res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        data: {
          status: "not_submitted",
          documentsReceived: [],
          submissionCount: 0,
          message: "No verification documents have been submitted",
        },
      });
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: {
        verificationId: verification._id.toString(),
        status: verification.status,
        submissionCount: verification.submissionCount,
        documentsReceived: verification.documentsReceived,
        hasDocuments: verification.documentsReceived.length > 0,
        reviewedBy: verification.reviewedBy,
        reviewedAt: verification.reviewedAt,
        reviewNotes: verification.reviewNotes,
        rejectionReason: verification.rejectionReason,
        createdAt: verification.createdAt,
        updatedAt: verification.updatedAt,
        message: "Verification status retrieved successfully",
      },
    });
  } catch (error) {
    console.error("Get verification status error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get driver onboarding status and progress
exports.getOnboardingStatus = async (req, res) => {
  try {
    const driver = await Driver.findById(req.driver.driverId).populate(
      "organization"
    );

    if (!driver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    const steps = [
      "registration",
      "phoneVerification",
      "paymentSetup",
      "documentVerification",
    ];
    let completedSteps = [];
    let remainingSteps = [];
    let currentStep = null;
    let isComplete = false;

    // Step 1: Registration (always completed if we reach here)
    completedSteps.push("registration");

    // Step 2: Phone Verification
    if (driver.phoneVerified) {
      completedSteps.push("phoneVerification");
    } else {
      currentStep = "phoneVerification";
      remainingSteps = steps.slice(1); // All steps except registration
      return buildResponse();
    }

    // Step 3: Payment Setup
    let paymentComplete = false;
    if (driver.plan === "payperuse") {
      paymentComplete = driver.payPerUseStatus === "paid";
    } else if (driver.plan === "monthly") {
      paymentComplete =
        driver.subscriptionStatus === "active" && driver.stripeSubscriptionId;
    }

    if (paymentComplete) {
      completedSteps.push("paymentSetup");
    } else {
      currentStep = "paymentSetup";
      remainingSteps = steps.slice(2); // paymentSetup and documentVerification
      return buildResponse();
    }

    // Step 4: Document Verification
    try {
      const verification = await DriverVerification.findOne({
        driverId: driver._id,
      });

      if (verification) {
        completedSteps.push("documentVerification");
        isComplete = true;
      } else {
        currentStep = "documentVerification";
        remainingSteps = ["documentVerification"];
        return buildResponse();
      }
    } catch (verificationError) {
      console.error("Error checking verification status:", verificationError);
      currentStep = "documentVerification";
      remainingSteps = ["documentVerification"];
      return buildResponse();
    }

    // Helper function to build response
    function buildResponse() {
      return res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        data: {
          isComplete,
          completedSteps,
          remainingSteps,
          currentStep,
          progress: {
            completed: completedSteps.length,
            total: steps.length,
            percentage: Math.round(
              (completedSteps.length / steps.length) * 100
            ),
          },
        },
      });
    }

    // If we reach here, onboarding is complete
    return buildResponse();
  } catch (error) {
    console.error("Get onboarding status error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to retrieve onboarding status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update driver profile
exports.updateDriverProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, currentPassword, newPassword } =
      req.body;

    // Get driver ID from token
    const driverId = req.driver.driverId;

    // Validation for basic info updates
    if (firstName && !validateFullName(firstName)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "First name must be between 2-100 characters",
      });
    }

    if (lastName && !validateFullName(lastName)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Last name must be between 2-100 characters",
      });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Valid phone number is required",
      });
    }

    // Find the existing driver
    const existingDriver = await Driver.findById(driverId);

    if (!existingDriver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Current password is required to set a new password",
        });
      }

      if (newPassword.length < 8) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "New password must be at least 8 characters long",
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await existingDriver.comparePassword(
        currentPassword
      );
      if (!isCurrentPasswordValid) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Current password is incorrect",
        });
      }
    }

    // Prepare update object
    const updateData = {};
    const updates = {};
    let phoneChanged = false;

    // Update basic information
    if (firstName && firstName !== existingDriver.firstName) {
      updateData.firstName = firstName;
      updates.firstName = firstName;
    }

    if (lastName && lastName !== existingDriver.lastName) {
      updateData.lastName = lastName;
      updates.lastName = lastName;
    }

    if (phone && phone !== existingDriver.phone) {
      // Check if new phone number is already in use by another driver
      const existingDriverByPhone = await Driver.findOne({
        phone: phone,
        _id: { $ne: driverId },
      });

      if (existingDriverByPhone) {
        return res.status(HTTP_STATUS_CODES.CONFLICT).json({
          success: false,
          message: "This phone number is already in use by another driver",
        });
      }

      updateData.phone = phone;
      updateData.phoneVerified = false; // Reset phone verification
      updates.phone = phone;
      phoneChanged = true;
    }

    // Handle password update
    if (newPassword) {
      updateData.password = newPassword;
    }

    // Update the driver using findByIdAndUpdate
    const updatedDriver = await Driver.findByIdAndUpdate(driverId, updateData, {
      new: true, // Return updated document
      runValidators: true, // Run schema validators
    })
      .populate("organization", "companyName urlSlug")
      .populate("role_id", "name description")
      .select("-password -registrationToken");

    if (!updatedDriver) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Driver not found during update",
      });
    }

    // Send OTP if phone was changed
    if (phoneChanged) {
      try {
        // Generate OTP for the updated driver
        const driverForOTP = await Driver.findById(driverId);
        const otp = driverForOTP.generateOTP();
        await driverForOTP.save();

        const formattedPhone = smsService.formatPhoneNumber(phone);
        await smsService.sendOTP(
          formattedPhone,
          otp,
          `${updatedDriver.firstName} ${updatedDriver.lastName}`
        );

        console.log(
          `OTP sent to new phone ${formattedPhone} for driver ${driverId}`
        );
      } catch (smsError) {
        console.error("Failed to send OTP to new phone:", smsError);
        // Don't fail the update if SMS fails
      }
    }

    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: {
        driver: updatedDriver,
        updates: updates,
        phoneVerificationRequired: phoneChanged,
        message: phoneChanged
          ? "Profile updated successfully. Please verify your new phone number."
          : "Profile updated successfully",
      },
    });
  } catch (error) {
    console.error("Update driver profile error:", error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get driver settings
exports.getSettings = async (req, res) => {
  const driverId = req.driver.driverId;
  // Find the existing driver
  const oldDriver = await Driver.findById(driverId);

  if (!oldDriver) {
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
      success: false,
      message: "Driver not found",
    });
  }

  const notif = oldDriver?.preferences?.notifications;
  const type = oldDriver?.preferences?.notification_type;
  const settings = {
    billingAlerts: type?.billing || false,
    emailNotifications: notif?.email || false,
    promotionalEmails: type?.promo_emails || false,
    pushNotifications: notif?.push || false,
    serviceUpdates: type?.service || false,
    smsNotifications: notif?.sms || false,
  };

  return res.status(HTTP_STATUS_CODES.OK).json({
    success: true,
    data: { settings },
  });
};

// Update driver settings
exports.updateSettings = async (req, res) => {
  let updatedData = {};
  const driverId = req.driver.driverId;
  const {
    billingAlerts,
    emailNotifications,
    promotionalEmails,
    pushNotifications,
    serviceUpdates,
    smsNotifications,
  } = req.body ?? req.body.settings;

  const notifications = {
    email: emailNotifications,
    push: pushNotifications,
    sms: smsNotifications,
  };

  const notification_type = {
    billing: billingAlerts,
    promo_emails: promotionalEmails,
    servce: serviceUpdates,
  };

  const updateData = {
    notifications,
    notification_type,
  };

  updatedData.preferences = updateData;
  // console.log({updateData, updatedData})

  const updatedDriver = await Driver.findByIdAndUpdate(driverId, updatedData, {
    new: true, // Return updated document
    runValidators: true, // Run schema validators
  });

  return res.status(HTTP_STATUS_CODES.OK).json({
    success: true,
    data: {
      driver: updatedDriver,
      settings: updatedData,
      message: "Notification Settings updated successfully",
    },
  });
};
