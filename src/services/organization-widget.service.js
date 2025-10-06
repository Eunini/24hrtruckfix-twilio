const { OrganizationWidget, Organization } = require("../models");
const vapiService = require("./vapi.service");

class OrganizationWidgetService {
  /**
   * Create a new widget for an organization
   */
  async createWidget(params) {
    const {
      organizationId,
      config,
      allowedOrigins = [],
      widgetType = "marketing",
    } = params;

    // Verify organization exists
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    // Check if widget already exists for this organization
    const existingWidget = await OrganizationWidget.findOne({ organizationId });
    if (existingWidget) {
      throw new Error(
        "A widget already exists for this Organization. Please update it instead."
      );
    }

    // Check if organization has marketing agents, if not create them
    if (widgetType === "marketing" && !organization.hasMarketingEnabled) {
      try {
        const orgName = organization.companyName || "Organization";
        const marketingAgents = await vapiService.createMarketingAgents(
          orgName,
          organizationId
        );

        // Update organization with marketing agents and enable marketing
        organization.hasMarketingEnabled = true;
        organization.marketingEnabledAt = new Date();

        // Store agent IDs in organization (you might want to add these fields to the model)
        // organization.marketingInboundAgentId = marketingAgents.inbound.id;
        // organization.marketingOutboundAgentId = marketingAgents.outbound.id;
        // organization.marketingWebAgentId = marketingAgents.web.id;

        await organization.save();

        console.log(
          `✅ Created marketing agents for organization ${organizationId}`
        );
      } catch (error) {
        console.error("❌ Failed to create marketing agents:", error);
        throw new Error("Failed to create marketing agents for organization");
      }
    }

    const widget = new OrganizationWidget({
      organizationId,
      config,
      allowedOrigins,
      widgetType,
    });

    return await widget.save();
  }

  /**
   * Update an existing widget
   */
  async updateWidget(params) {
    const { widgetId, config, allowedOrigins, isActive, user } = params;

    // Find the widget
    const widget = await OrganizationWidget.findById(widgetId);
    if (!widget) {
      throw new Error("Widget not found");
    }

    // Verify organization and check permissions
    const organization = await Organization.findById(widget.organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    // Update fields
    if (config !== undefined) {
      widget.config = config;
    }

    if (allowedOrigins !== undefined) {
      widget.allowedOrigins = allowedOrigins;
    }

    if (isActive !== undefined) {
      widget.isActive = isActive;
    }

    // Save and return updated widget
    return await widget.save();
  }

  /**
   * Delete a widget
   */
  async deleteWidget(widgetId) {
    // Find the widget
    const widget = await OrganizationWidget.findById(widgetId);
    if (!widget) {
      throw new Error("Widget not found");
    }

    // Verify organization and check permissions
    const organization = await Organization.findById(widget.organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    // Delete the widget
    const result = await OrganizationWidget.deleteOne({ _id: widgetId });
    return result.deletedCount > 0;
  }

  /**
   * Get a widget by ID
   */
  async getWidgetById(widgetId) {
    const widget = await OrganizationWidget.findById(widgetId);
    if (!widget) {
      throw new Error("Widget not found");
    }

    // Verify organization and check permissions
    const organization = await Organization.findById(widget.organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    return widget;
  }

  /**
   * Get a widget by organization ID
   */
  async getWidgetByOrganizationId(organizationId) {
    const widget = await OrganizationWidget.findOne({ organizationId });
    if (!widget) {
      return null;
    }

    // Verify organization and check permissions
    const organization = await Organization.findById(widget.organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    return widget;
  }

  /**
   * Get a widget by organization ID without permissions check (for public access)
   */
  async getWidgetByOrganizationIdWithoutPerms(organizationId) {
    const widget = await OrganizationWidget.findOne({
      organizationId,
      isActive: true,
    });
    if (!widget) {
      return null;
    }

    return widget;
  }

  /**
   * Get all widgets for an organization
   */
  async getWidgetsByOrganizationId(organizationId) {
    const widgets = await OrganizationWidget.find({ organizationId });

    // Verify organization and check permissions
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      throw new Error("Organization not found");
    }

    return widgets;
  }

  /**
   * Toggle widget active status
   */
  async toggleWidgetStatus(widgetId) {
    const widget = await OrganizationWidget.findById(widgetId);
    if (!widget) {
      throw new Error("Widget not found");
    }

    widget.isActive = !widget.isActive;
    return await widget.save();
  }

  /**
   * Get widget analytics (placeholder for future implementation)
   */
  async getWidgetAnalytics(widgetId, dateRange = {}) {
    const widget = await OrganizationWidget.findById(widgetId);
    if (!widget) {
      throw new Error("Widget not found");
    }

    // This is a placeholder for future analytics implementation
    // You can integrate with your analytics service here
    return {
      widgetId,
      totalInteractions: 0,
      uniqueVisitors: 0,
      conversionRate: 0,
      averageSessionDuration: 0,
      dateRange,
      message: "Analytics not yet implemented",
    };
  }
}

const organizationWidgetService = new OrganizationWidgetService();

module.exports = { organizationWidgetService };
