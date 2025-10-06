const axios = require("axios");

/**
 * Twilio Service for managing phone numbers and SMS
 */
class TwilioService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.baseURL = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`;

    if (!this.accountSid || !this.authToken) {
      throw new Error(
        "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables are required"
      );
    }
  }

  /**
   * Get authorization header for Twilio requests
   * @returns {string} Base64 encoded auth header
   */
  getAuthHeader() {
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString(
      "base64"
    );
    return `Basic ${auth}`;
  }

  /**
   * Search for available phone numbers
   * @param {string} countryCode - Country code (default: 'US')
   * @param {string} areaCode - Area code preference
   * @param {Object} options - Additional search options
   * @returns {Promise<Array>} Available phone numbers
   */
  async searchAvailableNumbers(
    countryCode = "US",
    areaCode = null,
    options = {}
  ) {
    try {
      let url = `${this.baseURL}/AvailablePhoneNumbers/${countryCode}/Local.json`;
      const params = new URLSearchParams();

      if (areaCode) {
        params.append("AreaCode", areaCode);
      }

      // Add additional search parameters
      if (options.contains) {
        params.append("Contains", options.contains);
      }
      if (options.nearLatLong) {
        params.append("NearLatLong", options.nearLatLong);
      }
      if (options.nearNumber) {
        params.append("NearNumber", options.nearNumber);
      }
      if (options.distance) {
        params.append("Distance", options.distance);
      }

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const response = await axios.get(url, {
        headers: {
          Authorization: this.getAuthHeader(),
        },
      });

      console.log(
        `📞 Found ${
          response.data.available_phone_numbers?.length || 0
        } available numbers`
      );
      return response.data.available_phone_numbers || [];
    } catch (error) {
      console.error(
        "❌ Twilio number search failed:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to search available numbers: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Purchase a phone number
   * @param {string} phoneNumber - Phone number to purchase
   * @param {Object} options - Purchase options
   * @returns {Promise<Object>} Purchased phone number data
   */
  async purchasePhoneNumber(phoneNumber, options = {}) {
    try {
      const purchaseData = new URLSearchParams({
        PhoneNumber: phoneNumber,
      });

      // Add optional parameters
      if (options.friendlyName) {
        purchaseData.append("FriendlyName", options.friendlyName);
      }
      if (options.voiceUrl) {
        purchaseData.append("VoiceUrl", options.voiceUrl);
      }
      if (options.voiceMethod) {
        purchaseData.append("VoiceMethod", options.voiceMethod);
      }
      if (options.smsUrl) {
        purchaseData.append("SmsUrl", options.smsUrl);
      }
      if (options.smsMethod) {
        purchaseData.append("SmsMethod", options.smsMethod);
      }

      const response = await axios.post(
        `${this.baseURL}/IncomingPhoneNumbers.json`,
        purchaseData,
        {
          headers: {
            Authorization: this.getAuthHeader(),
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      console.log(`✅ Twilio phone number purchased: ${phoneNumber}`);
      return response.data;
    } catch (error) {
      console.error(
        "❌ Twilio number purchase failed:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to purchase phone number: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Buy a phone number for an organization
   * @param {string} orgName - Organization name for friendly naming
   * @param {string} countryCode - Country code (default: 'US')
   * @param {string} areaCode - Preferred area code
   * @returns {Promise<Object>} Purchased phone number data
   */
  async buyPhoneNumberForOrganization(
    orgName,
    countryCode = "US",
    areaCode = null
  ) {
    try {
      console.log(`🔍 Searching for phone numbers for ${orgName}...`);

      // Search for available numbers
      const availableNumbers = await this.searchAvailableNumbers(
        countryCode,
        areaCode
      );

      if (!availableNumbers || availableNumbers.length === 0) {
        throw new Error(
          `No available phone numbers found for area code ${areaCode || "any"}`
        );
      }

      // Select the first available number
      const selectedNumber = availableNumbers[0];
      console.log(
        `📞 Selected number: ${selectedNumber.phone_number} for ${orgName}`
      );

      // Purchase the number
      const purchasedNumber = await this.purchasePhoneNumber(
        selectedNumber.phone_number,
        {
          friendlyName: `${orgName} - AI Service Line`,
        }
      );

      return {
        ...purchasedNumber,
        capabilities: selectedNumber.capabilities,
        locality: selectedNumber.locality,
        region: selectedNumber.region,
      };
    } catch (error) {
      console.error(
        `❌ Failed to buy phone number for ${orgName}:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Release/delete a phone number
   * @param {string} phoneNumberSid - Phone number SID to release
   * @returns {Promise<Object>} Release result
   */
  async releasePhoneNumber(phoneNumberSid) {
    try {
      const response = await axios.delete(
        `${this.baseURL}/IncomingPhoneNumbers/${phoneNumberSid}.json`,
        {
          headers: {
            Authorization: this.getAuthHeader(),
          },
        }
      );

      console.log(`✅ Twilio phone number released: ${phoneNumberSid}`);
      return response.data;
    } catch (error) {
      console.error(
        "❌ Twilio number release failed:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to release phone number: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Update phone number configuration
   * @param {string} phoneNumberSid - Phone number SID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated phone number data
   */
  async updatePhoneNumber(phoneNumberSid, updateData) {
    try {
      const formData = new URLSearchParams();

      Object.keys(updateData).forEach((key) => {
        if (updateData[key] !== undefined) {
          formData.append(key, updateData[key]);
        }
      });

      const response = await axios.post(
        `${this.baseURL}/IncomingPhoneNumbers/${phoneNumberSid}.json`,
        formData,
        {
          headers: {
            Authorization: this.getAuthHeader(),
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      console.log(`✅ Twilio phone number updated: ${phoneNumberSid}`);
      return response.data;
    } catch (error) {
      console.error(
        "❌ Twilio number update failed:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to update phone number: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Get phone number details
   * @param {string} phoneNumberSid - Phone number SID
   * @returns {Promise<Object>} Phone number data
   */
  async getPhoneNumber(phoneNumberSid) {
    try {
      const response = await axios.get(
        `${this.baseURL}/IncomingPhoneNumbers/${phoneNumberSid}.json`,
        {
          headers: {
            Authorization: this.getAuthHeader(),
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "❌ Failed to get Twilio phone number:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to get phone number: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * List all phone numbers for the account
   * @param {Object} options - List options
   * @returns {Promise<Array>} List of phone numbers
   */
  async listPhoneNumbers(options = {}) {
    try {
      let url = `${this.baseURL}/IncomingPhoneNumbers.json`;
      const params = new URLSearchParams();

      if (options.friendlyName) {
        params.append("FriendlyName", options.friendlyName);
      }
      if (options.phoneNumber) {
        params.append("PhoneNumber", options.phoneNumber);
      }
      if (options.pageSize) {
        params.append("PageSize", options.pageSize);
      }

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const response = await axios.get(url, {
        headers: {
          Authorization: this.getAuthHeader(),
        },
      });

      return response.data.incoming_phone_numbers || [];
    } catch (error) {
      console.error(
        "❌ Failed to list Twilio phone numbers:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to list phone numbers: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Send SMS message
   * @param {string} to - Recipient phone number
   * @param {string} from - Sender phone number
   * @param {string} body - Message body
   * @returns {Promise<Object>} SMS result
   */
  async sendSMS(to, from, body, returnError = false) {
    try {
      const messageData = new URLSearchParams({
        To: to,
        From: from,
        Body: body,
      });

      const response = await axios.post(
        `${this.baseURL}/Messages.json`,
        messageData,
        {
          headers: {
            Authorization: this.getAuthHeader(),
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      console.log(`✅ SMS sent from ${from} to ${to}`);
      return response.data;
    } catch (error) {
      if (returnError) {
        return error.response?.data || error.message;
      }
      console.error(
        "❌ SMS sending failed:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to send SMS: ${error.response?.data?.message || error.message}`
      );
    }
  }
}

module.exports = new TwilioService();
