const { Widget, Mechanic } = require("../models");
const vapiService = require("./vapi.service");

class WidgetService {
  /**
   * Create a new widget for a mechanic
   */
  async createWidget(params) {
    const { mechanicId, config, allowedOrigins = [] } = params;

    // Verify mechanic exists
    const mechanic = await Mechanic.findById(mechanicId);

    if (!mechanic) {
      throw new Error("Mechanic not found");
    }

    // Check if widget already exists for this mechanic
    const existingWidget = await Widget.findOne({ mechanicId });
    if (existingWidget) {
      throw new Error(
        "A widget already exists for this Mechanic. Please update it instead."
      );
    }

    // Check if mechanic has a web agent, if not create one
    if (!mechanic.web_agent_id) {
      try {
        const mechanicName =
          mechanic.businessName ||
          mechanic.companyName ||
          `${mechanic.firstName} ${mechanic.lastName}` ||
          "Mechanic";
        const webAgent = await vapiService.createWebAgent(
          mechanicName,
          mechanicId,
          mechanic.specialty,
          mechanic.serviceCapabilities,
          mechanic.OtherServices
        );

        // Update mechanic with web agent ID
        mechanic.web_agent_id = webAgent.id;
        await mechanic.save();

        console.log(
          `✅ Created web agent for mechanic ${mechanicId}: ${webAgent.id}`
        );
      } catch (error) {
        console.error("❌ Failed to create web agent:", error);
        throw new Error("Failed to create web agent for mechanic");
      }
    }

    // Create the new widget
    const widget = new Widget({
      mechanicId,
      config,
      allowedOrigins,
    });

    return await widget.save();
  }

  /**
   * Update an existing widget
   */
  async updateWidget(params) {
    const { widgetId, config, allowedOrigins, user } = params;

    // Find the widget
    const widget = await Widget.findById(widgetId);
    if (!widget) {
      throw new Error("Widget not found");
    }

    // Verify mechanic and check permissions
    const mechanic = await Mechanic.findById(widget.mechanicId);
    if (!mechanic) {
      throw new Error("Mechanic not found");
    }

    // Update fields
    if (config) {
      widget.config = config;
    }

    if (allowedOrigins) {
      widget.allowedOrigins = allowedOrigins;
    }

    // Save and return updated widget
    return await widget.save();
  }

  /**
   * Delete a widget
   */
  async deleteWidget(widgetId) {
    // Find the widget
    const widget = await Widget.findById(widgetId);
    if (!widget) {
      throw new Error("Widget not found");
    }

    // Verify mechanic and check permissions
    const mechanic = await Mechanic.findById(widget.mechanicId);
    if (!mechanic) {
      throw new Error("Mechanic not found");
    }

    // Delete the widget
    const result = await Widget.deleteOne({ _id: widgetId });
    return result.deletedCount > 0;
  }

  /**
   * Get a widget by ID
   */
  async getWidgetById(widgetId) {
    const widget = await Widget.findById(widgetId);
    if (!widget) {
      throw new Error("Widget not found");
    }

    // Verify mechanic and check permissions
    const mechanic = await Mechanic.findById(widget.mechanicId);

    if (!mechanic) {
      throw new Error("Mechanic not found");
    }

    return widget;
  }

  /**
   * Get a widget by mechanic ID
   */
  async getWidgetByMechanicId(mechanicId) {
    const widget = await Widget.findOne({ mechanicId });
    if (!widget) {
      return null;
    }

    // Verify mechanic and check permissions
    const mechanic = await Mechanic.findById(mechanicId);
    if (!mechanic) {
      throw new Error("Mechanic not found");
    }

    return widget;
  }

  /**
   * Get a widget by mechanic ID without permissions check
   */
  async getWidgetByMechanicIdWithoutPerms(mechanicId) {
    const widget = await Widget.findOne({ mechanicId });
    if (!widget) {
      return null;
    }

    return widget;
  }
}

const widgetService = new WidgetService();

module.exports = { widgetService };
