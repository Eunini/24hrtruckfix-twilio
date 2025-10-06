const vapiService = require("./vapi.service");
const twilioService = require("./twilio.service");
const aiConfigService = require("./aiConfig.service");
const {
  sendOrganizationApprovalEmail,
  // sendOrganizationSetupFailureEmail,
} = require("./mail/organizationApprovalMail");
const { Organization, User } = require("../models");

/**
 * Organization Setup Service for handling AI configuration during approval
 */
class OrganizationSetupService {
  /**
   * Setup AI configuration for a newly approved organization
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Setup options
   * @returns {Promise<Object>} Setup result
   */
  async setupOrganizationAI(organizationId, options = {}) {
    const setupStartTime = Date.now();
    let currentStep = "initialization";

    try {
      console.log(`🚀 Starting AI setup for organization: ${organizationId}`);

      // Step 1: Get organization and owner details
      currentStep = "fetching_organization_data";
      const organization = await Organization.findById(organizationId).populate(
        "owner"
      );

      if (!organization) {
        throw new Error("Organization not found");
      }

      if (!organization.owner) {
        throw new Error("Organization owner not found");
      }

      const orgName =
        organization.companyName ||
        organization.name ||
        `Organization-${organizationId.slice(-8)}`;
      const ownerInfo = organization.owner;

      console.log(
        `📋 Setting up AI for: ${orgName} (Owner: ${ownerInfo.firstname} ${ownerInfo.lastname})`
      );

      // Step 2: Check if AI config already exists
      currentStep = "checking_existing_config";
      const existingConfig = await aiConfigService.getAIConfigByClientId(
        ownerInfo._id
      );

      if (existingConfig) {
        console.log(
          `⚠️ AI configuration already exists for organization: ${orgName}`
        );
        return {
          success: true,
          message: "AI configuration already exists",
          existing: true,
          config: existingConfig,
        };
      }

      // Create inbound assistant
      const inboundAssistant = await vapiService.createInboundAssistant(
        orgName,
        organizationId
      );
      console.log(`✅ Inbound assistant created: ${inboundAssistant.id}`);

      // Create outbound assistant
      const outboundAssistant = await vapiService.createOutboundAssistant(
        orgName,
        organizationId
      );
      console.log(`✅ Outbound assistant created: ${outboundAssistant.id}`);

      let vapiPhoneNumber;
      let phoneNumberData;

      // Step 3: Purchase Twilio phone number
      if (organization.inboundAi) {
        currentStep = "purchasing_phone_number";
        console.log(`📞 Purchasing phone number for ${orgName}...`);

        const phoneNumberData =
          await twilioService.buyPhoneNumberForOrganization(
            orgName,
            options.countryCode || "US",
            options.areaCode
          );
        console.log(
          `✅ Phone number purchased: ${phoneNumberData.phone_number}`
        );

        // Step 4: Create VAPI assistants
        currentStep = "creating_vapi_assistants";
        console.log(`🤖 Creating VAPI assistants for ${orgName}...`);

        // Step 5: Register phone number with VAPI (using inbound assistant as primary)
        currentStep = "registering_phone_with_vapi";
        console.log(`📱 Registering phone number with VAPI...`);

        vapiPhoneNumber = await vapiService.registerPhoneNumber(
          phoneNumberData.phone_number,
          inboundAssistant.id,
          orgName,
          "inbound"
        );

        console.log(
          `✅ Phone number registered with VAPI: ${vapiPhoneNumber.id}`
        );
      }

      // Step 6: Save AI configuration to database
      currentStep = "saving_ai_config";
      console.log(`💾 Saving AI configuration to database...`);

      const aiConfigData = {
        client_id: ownerInfo._id,
        organization_id: organizationId,
        outbound_assistant_id: outboundAssistant.id,
        inbound_assistant_id: inboundAssistant.id,
        number: phoneNumberData?.phone_number || "",
        phone_number_sid: phoneNumberData?.sid || "",
        vapi_phone_number_id: vapiPhoneNumber?.id || "",
        status: "active",
        setup_completed: true,
        setup_date: new Date(),
      };

      const savedConfig = await aiConfigService.createAIConfig(aiConfigData);
      console.log(`✅ AI configuration saved: ${savedConfig._id}`);

      // Step 7: Send approval email
      currentStep = "sending_approval_email";
      console.log(`📧 Sending approval email to ${ownerInfo.email}...`);

      if (ownerInfo.email) {
        try {
          await sendOrganizationApprovalEmail(
            ownerInfo.email,
            {
              companyName: orgName,
              status: "Approved",
              approvedAt: new Date(),
            },
            {
              firstname: ownerInfo.firstname,
              lastname: ownerInfo.lastname,
              name: `${ownerInfo.firstname} ${ownerInfo.lastname}`,
              email: ownerInfo.email,
            },
            {
              phoneNumber: phoneNumberData?.phone_number || "",
              inboundAssistantId: inboundAssistant.id,
              outboundAssistantId: outboundAssistant.id,
              setupDate: new Date(),
            }
          );
          console.log(`✅ Approval email sent successfully`);
        } catch (emailError) {
          console.warn(
            `⚠️ Failed to send approval email: ${emailError.message}`
          );
          // Don't fail the entire setup if email fails
        }
      } else {
        console.warn(`⚠️ No email address found for owner: ${ownerInfo._id}`);
      }

      const setupTime = Date.now() - setupStartTime;
      console.log(
        `🎉 AI setup completed successfully for ${orgName} in ${setupTime}ms`
      );

      return {
        success: true,
        message: "AI setup completed successfully",
        setupTime: `${setupTime}ms`,
        data: {
          organization: {
            id: organizationId,
            name: orgName,
          },
          phoneNumber: phoneNumberData.phone_number,
          phoneNumberSid: phoneNumberData.sid,
          assistants: {
            inbound: {
              id: inboundAssistant.id,
              name: inboundAssistant.name,
            },
            outbound: {
              id: outboundAssistant.id,
              name: outboundAssistant.name,
            },
          },
          vapiPhoneNumberId: vapiPhoneNumber.id,
          aiConfigId: savedConfig._id,
          emailSent: !!ownerInfo.email,
        },
      };
    } catch (error) {
      const setupTime = Date.now() - setupStartTime;
      console.error(
        `❌ AI setup failed for organization ${organizationId} at step '${currentStep}':`,
        error.message
      );

      // Send failure notification email if we have owner info
      try {
        const organization = await Organization.findById(
          organizationId
        ).populate("owner");
        // if (organization?.owner?.email) {
        //   await sendOrganizationSetupFailureEmail(
        //     organization.owner.email,
        //     {
        //       companyName:
        //         organization.companyName ||
        //         organization.name ||
        //         "Your Organization",
        //     },
        //     {
        //       firstname: organization.owner.firstname,
        //       lastname: organization.owner.lastname,
        //       name: `${organization.owner.firstname} ${organization.owner.lastname}`,
        //     },
        //     {
        //       step: currentStep,
        //       error: error.message,
        //       timestamp: new Date(),
        //     }
        //   );
        //   console.log(`📧 Failure notification email sent`);
        // }
      } catch (emailError) {
        console.warn(
          `⚠️ Failed to send failure notification email: ${emailError.message}`
        );
      }

      return {
        success: false,
        message: `AI setup failed at step: ${currentStep}`,
        error: error.message,
        step: currentStep,
        setupTime: `${setupTime}ms`,
      };
    }
  }

  /**
   * Cleanup AI configuration for an organization
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOrganizationAI(organizationId) {
    try {
      console.log(`🧹 Starting AI cleanup for organization: ${organizationId}`);

      // Get AI configuration
      const aiConfig = await aiConfigService.getAIConfigByOrganizationId(
        organizationId
      );

      if (!aiConfig) {
        console.log(
          `⚠️ No AI configuration found for organization: ${organizationId}`
        );
        return {
          success: true,
          message: "No AI configuration to cleanup",
        };
      }

      const cleanupResults = {
        phoneNumberReleased: false,
        inboundAssistantDeleted: false,
        outboundAssistantDeleted: false,
        vapiPhoneNumberDeleted: false,
        configDeleted: false,
      };

      // Delete VAPI assistants
      try {
        if (aiConfig.inbound_assistant_id) {
          await vapiService.deleteAssistant(aiConfig.inbound_assistant_id);
          cleanupResults.inboundAssistantDeleted = true;
          console.log(
            `✅ Inbound assistant deleted: ${aiConfig.inbound_assistant_id}`
          );
        }
      } catch (error) {
        console.warn(`⚠️ Failed to delete inbound assistant: ${error.message}`);
      }

      try {
        if (aiConfig.outbound_assistant_id) {
          await vapiService.deleteAssistant(aiConfig.outbound_assistant_id);
          cleanupResults.outboundAssistantDeleted = true;
          console.log(
            `✅ Outbound assistant deleted: ${aiConfig.outbound_assistant_id}`
          );
        }
      } catch (error) {
        console.warn(
          `⚠️ Failed to delete outbound assistant: ${error.message}`
        );
      }

      // Delete VAPI phone number
      try {
        if (aiConfig.vapi_phone_number_id) {
          await vapiService.deletePhoneNumber(aiConfig.vapi_phone_number_id);
          cleanupResults.vapiPhoneNumberDeleted = true;
          console.log(
            `✅ VAPI phone number deleted: ${aiConfig.vapi_phone_number_id}`
          );
        }
      } catch (error) {
        console.warn(`⚠️ Failed to delete VAPI phone number: ${error.message}`);
      }

      // Release Twilio phone number
      try {
        if (aiConfig.phone_number_sid) {
          await twilioService.releasePhoneNumber(aiConfig.phone_number_sid);
          cleanupResults.phoneNumberReleased = true;
          console.log(
            `✅ Twilio phone number released: ${aiConfig.phone_number_sid}`
          );
        }
      } catch (error) {
        console.warn(
          `⚠️ Failed to release Twilio phone number: ${error.message}`
        );
      }

      // Delete AI configuration from database
      try {
        await aiConfigService.deleteAIConfig(aiConfig._id);
        cleanupResults.configDeleted = true;
        console.log(`✅ AI configuration deleted: ${aiConfig._id}`);
      } catch (error) {
        console.warn(`⚠️ Failed to delete AI configuration: ${error.message}`);
      }

      console.log(
        `🎉 AI cleanup completed for organization: ${organizationId}`
      );

      return {
        success: true,
        message: "AI cleanup completed",
        results: cleanupResults,
      };
    } catch (error) {
      console.error(
        `❌ AI cleanup failed for organization ${organizationId}:`,
        error.message
      );
      return {
        success: false,
        message: "AI cleanup failed",
        error: error.message,
      };
    }
  }

  /**
   * Get AI setup status for an organization
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>} Setup status
   */
  async getSetupStatus(organizationId) {
    try {
      const aiConfig = await aiConfigService.getAIConfigByOrganizationId(
        organizationId
      );

      if (!aiConfig) {
        return {
          hasSetup: false,
          message: "No AI configuration found",
        };
      }

      return {
        hasSetup: true,
        setupCompleted: aiConfig.setup_completed,
        status: aiConfig.status,
        setupDate: aiConfig.setup_date,
        phoneNumber: aiConfig.number,
        assistants: {
          inbound: aiConfig.inbound_assistant_id,
          outbound: aiConfig.outbound_assistant_id,
        },
        configId: aiConfig._id,
      };
    } catch (error) {
      console.error(
        `❌ Failed to get setup status for organization ${organizationId}:`,
        error.message
      );
      return {
        hasSetup: false,
        error: error.message,
      };
    }
  }

  /**
   * Retry failed setup for an organization
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Retry options
   * @returns {Promise<Object>} Retry result
   */
  async retrySetup(organizationId, options = {}) {
    try {
      console.log(`🔄 Retrying AI setup for organization: ${organizationId}`);

      // First cleanup any partial setup
      await this.cleanupOrganizationAI(organizationId);

      // Then retry the full setup
      return await this.setupOrganizationAI(organizationId, options);
    } catch (error) {
      console.error(
        `❌ Retry setup failed for organization ${organizationId}:`,
        error.message
      );
      return {
        success: false,
        message: "Retry setup failed",
        error: error.message,
      };
    }
  }
}

module.exports = new OrganizationSetupService();
