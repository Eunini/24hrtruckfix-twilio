const axios = require("axios");

class HubSpotService {
  constructor() {
    if (!process.env.HUBSPOT_API_KEY) {
      throw new Error(
        "HUBSPOT_API_KEY is not defined in environment variables"
      );
    }

    this.apiKey = process.env.HUBSPOT_API_KEY;
    this.baseURL = "https://api.hubapi.com";
    this.headers = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Create a new contact in HubSpot
   * @param {Object} contactData - Contact information
   * @returns {Promise<Object>} Created contact object
   */
  async createContact(contactData) {
    try {
      const {
        email,
        firstName,
        lastName,
        phone,
        company,
        jobTitle,
        address,
        city,
        state,
        zip,
        country,
        website,
        lifecycleStage,
        leadStatus,
        customProperties = {},
      } = contactData;

      const properties = {
        email,
        firstname: firstName,
        lastname: lastName,
        phone,
        company,
        jobtitle: jobTitle,
        address,
        city,
        state,
        zip,
        country,
        website,
        lifecyclestage: lifecycleStage,
        hs_lead_status: leadStatus,
        ...customProperties,
      };

      // Remove undefined properties
      Object.keys(properties).forEach((key) => {
        if (properties[key] === undefined || properties[key] === null) {
          delete properties[key];
        }
      });

      const response = await axios.post(
        `${this.baseURL}/crm/v3/objects/contacts`,
        { properties },
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Error creating HubSpot contact:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to create HubSpot contact: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Create a new task in HubSpot
   * @param {Object} taskData - Task information
   * @returns {Promise<Object>} Created task object
   */
  async createTask(taskData) {
    try {
      const {
        subject,
        body,
        status,
        priority,
        dueDate,
        ownerId,
        contactId,
        companyId,
        dealId,
        ticketId,
        customProperties = {},
      } = taskData;

      const properties = {
        hs_timestamp: dueDate
          ? new Date(dueDate).toISOString()
          : new Date().toISOString(),
        hs_task_subject: subject,
        hs_task_body: body,
        hs_task_status: status || "NOT_STARTED",
        hs_task_priority: priority || "MEDIUM",
        hs_task_completion_date: undefined,
        hs_task_completion_notes: undefined,
        hs_task_type: "CALL",
        ...customProperties,
      };

      // Add associations if provided
      const associations = [];
      if (contactId) {
        associations.push({
          to: { id: contactId },
          types: [
            { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 1 },
          ],
        });
      }
      if (companyId) {
        associations.push({
          to: { id: companyId },
          types: [
            { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 2 },
          ],
        });
      }
      if (dealId) {
        associations.push({
          to: { id: dealId },
          types: [
            { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 },
          ],
        });
      }
      if (ticketId) {
        associations.push({
          to: { id: ticketId },
          types: [
            { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 15 },
          ],
        });
      }

      const requestBody = { properties };
      if (associations.length > 0) {
        requestBody.associations = associations;
      }

      const response = await axios.post(
        `${this.baseURL}/crm/v3/objects/tasks`,
        requestBody,
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Error creating HubSpot task:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to create HubSpot task: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Get a contact by ID
   * @param {string} contactId - HubSpot contact ID
   * @returns {Promise<Object>} Contact object
   */
  async getContact(contactId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/crm/v3/objects/contacts/${contactId}`,
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Error getting HubSpot contact:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to get HubSpot contact: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Get a task by ID
   * @param {string} taskId - HubSpot task ID
   * @returns {Promise<Object>} Task object
   */
  async getTask(taskId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/crm/v3/objects/tasks/${taskId}`,
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Error getting HubSpot task:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to get HubSpot task: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Update a contact
   * @param {string} contactId - HubSpot contact ID
   * @param {Object} updateData - Contact update data
   * @returns {Promise<Object>} Updated contact object
   */
  async updateContact(contactId, updateData) {
    try {
      const response = await axios.patch(
        `${this.baseURL}/crm/v3/objects/contacts/${contactId}`,
        { properties: updateData },
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Error updating HubSpot contact:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to update HubSpot contact: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Update a task
   * @param {string} taskId - HubSpot task ID
   * @param {Object} updateData - Task update data
   * @returns {Promise<Object>} Updated task object
   */
  async updateTask(taskId, updateData) {
    try {
      const response = await axios.patch(
        `${this.baseURL}/crm/v3/objects/tasks/${taskId}`,
        { properties: updateData },
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Error updating HubSpot task:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to update HubSpot task: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Delete a contact
   * @param {string} contactId - HubSpot contact ID
   * @returns {Promise<Object>} Deletion response
   */
  async deleteContact(contactId) {
    try {
      const response = await axios.delete(
        `${this.baseURL}/crm/v3/objects/contacts/${contactId}`,
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Error deleting HubSpot contact:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to delete HubSpot contact: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  /**
   * Delete a task
   * @param {string} taskId - HubSpot task ID
   * @returns {Promise<Object>} Deletion response
   */
  async deleteTask(taskId) {
    try {
      const response = await axios.delete(
        `${this.baseURL}/crm/v3/objects/tasks/${taskId}`,
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Error deleting HubSpot task:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to delete HubSpot task: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }
}

module.exports = HubSpotService;
