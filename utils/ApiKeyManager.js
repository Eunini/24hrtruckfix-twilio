/**
 * API Key Rotation Utility
 * 
 * This utility provides functions to manage API key rotation for external services.
 * It supports:
 * - Fetching the current active key from environment variables
 * - Rotating keys based on a schedule
 * - Handling fallback to secondary keys
 * 
 * Services supported:
 * - Twilio
 * - Stripe
 * - OpenAI
 * - Google APIs
 */

// Import required modules
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

class ApiKeyManager {
  /**
   * Initialize the API key manager
   * @param {Object} options - Configuration options
   * @param {string} options.service - Service name (twilio, stripe, openai, google)
   * @param {string} options.envPath - Path to .env file (optional)
   * @param {boolean} options.useRotation - Whether to use key rotation (default: false)
   */
  constructor(options = {}) {
    this.service = options.service?.toLowerCase();
    this.envPath = options.envPath || path.join(process.cwd(), '.env');
    this.useRotation = options.useRotation || false;
    this.keyPrefix = this._getKeyPrefix();
    this.primaryKey = null;
    this.secondaryKey = null;
    this.keyMetadata = {};
    
    this._loadKeys();
  }

  /**
   * Get the correct environment variable prefix for the service
   * @private
   * @returns {string} Environment variable prefix
   */
  _getKeyPrefix() {
    switch (this.service) {
      case 'twilio':
        return 'TWILIO';
      case 'stripe':
        return 'STRIPE';
      case 'openai':
        return 'OPENAI';
      case 'google':
        return 'GOOGLE';
      default:
        throw new Error(`Unsupported service: ${this.service}`);
    }
  }

  /**
   * Load API keys from environment variables
   * @private
   */
  _loadKeys() {
    // Try to load keys from env vars
    if (this.service === 'twilio') {
      this.primaryKey = {
        sid: process.env.TWILIO_ACCOUNT_SID,
        token: process.env.TWILIO_AUTH_TOKEN
      };
      this.secondaryKey = {
        sid: process.env.TWILIO_ACCOUNT_SID_SECONDARY,
        token: process.env.TWILIO_AUTH_TOKEN_SECONDARY
      };
    } else if (this.service === 'stripe') {
      this.primaryKey = process.env.STRIPE_SECRET_KEY;
      this.secondaryKey = process.env.STRIPE_SECRET_KEY_SECONDARY;
    } else if (this.service === 'openai') {
      this.primaryKey = process.env.OPENAI_API_KEY;
      this.secondaryKey = process.env.OPENAI_API_KEY_SECONDARY;
    } else if (this.service === 'google') {
      this.primaryKey = process.env.GOOGLE_API_KEY;
      this.secondaryKey = process.env.GOOGLE_API_KEY_SECONDARY;
    }
    
    this.keyMetadata = {
      lastRotation: new Date(),
      currentlyActive: 'primary',
    };
  }

  /**
   * Get the current active API key
   * @returns {string|Object} The current active API key
   */
  getCurrentKey() {
    return this.keyMetadata.currentlyActive === 'primary' 
      ? this.primaryKey 
      : this.secondaryKey;
  }

  /**
   * Switch to the secondary key
   * @returns {string|Object} The new active key
   */
  useSecondaryKey() {
    if (!this.secondaryKey) {
      console.warn(`No secondary ${this.service} key available`);
      return this.primaryKey;
    }
    
    console.log(`Switching to secondary ${this.service} key`);
    this.keyMetadata.currentlyActive = 'secondary';
    return this.getCurrentKey();
  }

  /**
   * Rotate API keys (switch between primary and secondary)
   * @returns {boolean} Success status
   */
  rotateKeys() {
    if (!this.useRotation) {
      console.warn('Key rotation is disabled');
      return false;
    }
    
    if (!this.secondaryKey) {
      console.warn(`Cannot rotate ${this.service} keys: No secondary key available`);
      return false;
    }
    
    this.keyMetadata.currentlyActive = 
      this.keyMetadata.currentlyActive === 'primary' ? 'secondary' : 'primary';
    this.keyMetadata.lastRotation = new Date();
    
    console.log(`Rotated ${this.service} API keys successfully`);
    return true;
  }

  /**
   * Check if the API key is valid
   * @returns {boolean} Whether the current key is valid
   */
  isCurrentKeyValid() {
    const currentKey = this.getCurrentKey();
    
    if (!currentKey) {
      return false;
    }
    
    if (this.service === 'twilio') {
      return Boolean(currentKey.sid && currentKey.token);
    }
    
    return Boolean(currentKey);
  }

  /**
   * Get a list of service configuration settings
   * @returns {Object} Configuration settings
   */
  getServiceConfig() {
    return {
      service: this.service,
      hasSecondaryKey: Boolean(this.secondaryKey),
      keyRotationEnabled: this.useRotation,
      lastRotation: this.keyMetadata.lastRotation,
      currentlyActive: this.keyMetadata.currentlyActive,
    };
  }
}

module.exports = ApiKeyManager;