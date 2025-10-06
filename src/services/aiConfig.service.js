const {AIConfig} = require('../models/index');
const { Types: { ObjectId } } = require('mongoose');

/**
 * AI Config Service for managing AI configurations
 */
class AIConfigService {
  /**
   * Create a new AI configuration
   * @param {Object} configData - AI configuration data
   * @returns {Promise<Object>} Created AI config
   */
  async createAIConfig(configData) {
    try {
      const {
        client_id,
        outbound_assistant_id,
        inbound_assistant_id,
        number,
        phone_number_sid,
        vapi_phone_number_id,
        organization_id
      } = configData;

      // Validate required fields
      if (!client_id || !outbound_assistant_id || !inbound_assistant_id || !number) {
        throw new Error('client_id, outbound_assistant_id, inbound_assistant_id, and number are required');
      }

      // Check if config already exists for this client
      const existingConfig = await AIConfig.findOne({ 
        client_id: { $in: [new ObjectId(client_id)] }
      });

      if (existingConfig) {
        throw new Error('AI configuration already exists for this client');
      }

      const newConfig = await AIConfig.create({
        client_id: [new ObjectId(client_id)],
        outbound_assistant_id,
        inbound_assistant_id,
        number,
        phone_number_sid,
        vapi_phone_number_id,
        organization_id: organization_id ? new ObjectId(organization_id) : undefined
      });

      console.log(`✅ AI Config created for client ${client_id} with number ${number}`);
      return newConfig;
    } catch (error) {
      console.error('❌ Error creating AI config:', error.message);
      throw error;
    }
  }

  /**
   * Get AI configuration by client ID
   * @param {string} clientId - Client ID
   * @returns {Promise<Object|null>} AI configuration
   */
  async getAIConfigByClientId(clientId) {
    try {
      const config = await AIConfig.findOne({ 
        client_id: { $in: [new ObjectId(clientId)] }
      }).populate('client_id');

      return config;
    } catch (error) {
      console.error('❌ Error getting AI config by client ID:', error.message);
      throw error;
    }
  }

  /**
   * Get AI configuration by organization ID
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object|null>} AI configuration
   */
  async getAIConfigByOrganizationId(organizationId) {
    try {
      const config = await AIConfig.findOne({ 
        organization_id: new ObjectId(organizationId)
      }).populate('client_id');

      return config;
    } catch (error) {
      console.error('❌ Error getting AI config by organization ID:', error.message);
      throw error;
    }
  }

  /**
   * Get AI configuration by phone number
   * @param {string} phoneNumber - Phone number
   * @returns {Promise<Object|null>} AI configuration
   */
  async getAIConfigByPhoneNumber(phoneNumber) {
    try {
      const config = await AIConfig.findOne({ number: phoneNumber })
        .populate('client_id');

      return config;
    } catch (error) {
      console.error('❌ Error getting AI config by phone number:', error.message);
      throw error;
    }
  }

  /**
   * Update AI configuration
   * @param {string} configId - AI config ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated AI config
   */
  async updateAIConfig(configId, updateData) {
    try {
      const config = await AIConfig.findById(configId);
      if (!config) {
        throw new Error('AI configuration not found');
      }

      // Handle client_id array updates
      if (updateData.client_id) {
        updateData.client_id = Array.isArray(updateData.client_id) 
          ? updateData.client_id.map(id => new ObjectId(id))
          : [new ObjectId(updateData.client_id)];
      }

      // Handle organization_id updates
      if (updateData.organization_id) {
        updateData.organization_id = new ObjectId(updateData.organization_id);
      }

      Object.assign(config, updateData);
      await config.save();

      console.log(`✅ AI Config updated: ${configId}`);
      return config;
    } catch (error) {
      console.error('❌ Error updating AI config:', error.message);
      throw error;
    }
  }

  /**
   * Delete AI configuration
   * @param {string} configId - AI config ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteAIConfig(configId) {
    try {
      const config = await AIConfig.findByIdAndDelete(configId);
      if (!config) {
        throw new Error('AI configuration not found');
      }

      console.log(`✅ AI Config deleted: ${configId}`);
      return config;
    } catch (error) {
      console.error('❌ Error deleting AI config:', error.message);
      throw error;
    }
  }

  /**
   * Delete AI configuration by client ID
   * @param {string} clientId - Client ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteAIConfigByClientId(clientId) {
    try {
      const config = await AIConfig.findOneAndDelete({ 
        client_id: { $in: [new ObjectId(clientId)] }
      });

      if (!config) {
        throw new Error('AI configuration not found for this client');
      }

      console.log(`✅ AI Config deleted for client: ${clientId}`);
      return config;
    } catch (error) {
      console.error('❌ Error deleting AI config by client ID:', error.message);
      throw error;
    }
  }

  /**
   * Get all AI configurations
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of AI configurations
   */
  async getAllAIConfigs(options = {}) {
    try {
      const { page = 1, limit = 10, populate = true } = options;
      
      let query = AIConfig.find({});
      
      if (populate) {
        query = query.populate('client_id', 'firstname lastname email phoneNumber');
      }

      if (options.pagination !== false) {
        const skip = (page - 1) * limit;
        query = query.skip(skip).limit(limit);
      }

      const configs = await query.sort({ createdAt: -1 });
      return configs;
    } catch (error) {
      console.error('❌ Error getting all AI configs:', error.message);
      throw error;
    }
  }

  /**
   * Add client to existing AI configuration
   * @param {string} configId - AI config ID
   * @param {string} clientId - Client ID to add
   * @returns {Promise<Object>} Updated AI config
   */
  async addClientToConfig(configId, clientId) {
    try {
      const config = await AIConfig.findById(configId);
      if (!config) {
        throw new Error('AI configuration not found');
      }

      const clientObjectId = new ObjectId(clientId);
      
      // Check if client is already in the array
      const clientExists = config.client_id.some(id => id.equals(clientObjectId));
      if (clientExists) {
        throw new Error('Client is already associated with this AI configuration');
      }

      config.client_id.push(clientObjectId);
      await config.save();

      console.log(`✅ Client ${clientId} added to AI Config ${configId}`);
      return config;
    } catch (error) {
      console.error('❌ Error adding client to AI config:', error.message);
      throw error;
    }
  }

  /**
   * Remove client from AI configuration
   * @param {string} configId - AI config ID
   * @param {string} clientId - Client ID to remove
   * @returns {Promise<Object>} Updated AI config
   */
  async removeClientFromConfig(configId, clientId) {
    try {
      const config = await AIConfig.findById(configId);
      if (!config) {
        throw new Error('AI configuration not found');
      }

      const clientObjectId = new ObjectId(clientId);
      config.client_id = config.client_id.filter(id => !id.equals(clientObjectId));
      
      await config.save();

      console.log(`✅ Client ${clientId} removed from AI Config ${configId}`);
      return config;
    } catch (error) {
      console.error('❌ Error removing client from AI config:', error.message);
      throw error;
    }
  }

  /**
   * Check if AI configuration exists for client
   * @param {string} clientId - Client ID
   * @returns {Promise<boolean>} Whether config exists
   */
  async hasAIConfig(clientId) {
    try {
      const config = await AIConfig.findOne({ 
        client_id: { $in: [new ObjectId(clientId)] }
      });

      return !!config;
    } catch (error) {
      console.error('❌ Error checking AI config existence:', error.message);
      return false;
    }
  }

  /**
   * Get AI configuration statistics
   * @returns {Promise<Object>} Statistics
   */
  async getAIConfigStats() {
    try {
      const totalConfigs = await AIConfig.countDocuments();
      const configsWithMultipleClients = await AIConfig.countDocuments({
        $expr: { $gt: [{ $size: "$client_id" }, 1] }
      });

      return {
        totalConfigs,
        configsWithMultipleClients,
        configsWithSingleClient: totalConfigs - configsWithMultipleClients
      };
    } catch (error) {
      console.error('❌ Error getting AI config stats:', error.message);
      throw error;
    }
  }
}

module.exports = new AIConfigService(); 