const twilio = require("twilio");

// SMS Service for sending OTP messages
class SMSService {
  constructor() {
    this.provider = process.env.SMS_PROVIDER || "console"; // console, twilio, etc.
    this.init();
  }

  init() {
    if (this.provider === "twilio") {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    }
  }

  async sendOTP(phoneNumber, otp, driverName = "") {
    const message = `Your 24HourService verification code is: ${otp}. This code will expire in 10 minutes.`;

    try {
      switch (this.provider) {
        case "twilio":
          return await this.sendViaTwilio(phoneNumber, message);

        case "console":
        default:
          return await this.sendViaConsole(phoneNumber, message, otp);
      }
    } catch (error) {
      console.error("SMS sending error:", error);
      throw new Error("Failed to send SMS");
    }
  }

  async sendViaTwilio(phoneNumber, message) {
    if (!this.client || !this.fromNumber) {
      throw new Error("Twilio not properly configured");
    }

    const result = await this.client.messages.create({
      body: message,
      from: this.fromNumber,
      to: phoneNumber,
    });

    return {
      success: true,
      messageId: result.sid,
      provider: "twilio",
    };
  }

  async sendViaConsole(phoneNumber, message, otp) {
    // For development - log to console instead of sending real SMS
    console.log("\n📱 SMS SIMULATION (Development Mode)");
    console.log("=====================================");
    console.log(`📞 To: ${phoneNumber}`);
    console.log(`💬 Message: ${message}`);
    console.log(`🔢 OTP: ${otp}`);
    console.log("=====================================\n");

    return {
      success: true,
      messageId: `console_${Date.now()}`,
      provider: "console",
    };
  }

  // Format phone number to E.164 format
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, "");

    // If it starts with 1 and is 11 digits, it's likely US/Canada
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+${cleaned}`;
    }

    // If it's 10 digits, assume US/Canada and add +1
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }

    // If it already starts with +, return as is
    if (phoneNumber.startsWith("+")) {
      return phoneNumber;
    }

    // Otherwise, assume it needs + prefix
    return `+${cleaned}`;
  }

  // Validate phone number format
  isValidPhoneNumber(phoneNumber) {
    const formatted = this.formatPhoneNumber(phoneNumber);
    // Basic E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(formatted);
  }
}

module.exports = new SMSService();
