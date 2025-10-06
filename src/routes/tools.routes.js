const express = require('express');
const router = express.Router();
const { customPromptService } = require('../services/customPrompt.service');
const { clientCustomPromptService } = require('../services/clientCustomPrompt.service');
const CustomPrompt = require('../models/customPrompt.model');
const ClientCustomPrompt = require('../models/clientCustomPrompt.model');
const { Organization } = require('../models');

/**
 * Manage tools for prompts (both customPrompt and clientCustomPrompt)
 * POST /api/v1/tools/manage
 * Body: {
 *   promptId: string,
 *   promptType: 'custom' | 'client',
 *   toolName: string,
 *   enabled: boolean,
 *   metadata?: object
 * }
 */
router.post('/manage', async (req, res) => {
  try {
    const { promptId, promptType, toolName, enabled, metadata = {} } = req.body;

    // Validate required fields
    if (!promptId || !promptType || !toolName || typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: promptId, promptType, toolName, enabled'
      });
    }

    // Validate promptType
    if (!['custom', 'client'].includes(promptType)) {
      return res.status(400).json({
        success: false,
        message: 'promptType must be either "custom" or "client"'
      });
    }

    // Validate toolName
    const validTools = ['endcall', 'bookappointment', 'knowledgebase', 'calltransfer'];
    if (!validTools.includes(toolName.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid tool name. Valid tools: ${validTools.join(', ')}`
      });
    }

    let prompt;
    let service;
    let Model;

    // Get the appropriate model and service
    if (promptType === 'custom') {
      Model = CustomPrompt;
      service = customPromptService;
    } else {
      Model = ClientCustomPrompt;
      service = clientCustomPromptService;
    }

    // Find the prompt
    prompt = await Model.findById(promptId);
    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: 'Prompt not found'
      });
    }

    // Special validation for booking appointment tool
    if (toolName.toLowerCase() === 'bookappointment' && enabled) {
      let organizationId;
      
      if (promptType === 'custom') {
        // For custom prompts, get organization from mechanic
        const { Mechanic } = require('../models');
        const mechanic = await Mechanic.findById(prompt.mechanicId);
        if (!mechanic) {
          return res.status(404).json({
            success: false,
            message: 'Associated mechanic not found'
          });
        }
        organizationId = mechanic.organizationId;
      } else {
        // For client prompts, organization is directly available
        organizationId = prompt.organizationId;
      }

      // Check if organization has active calendar connection
      const organization = await Organization.findById(organizationId);
      if (!organization || !organization.calendar_connection || 
          !organization.calendar_connection.id_token) {
        return res.status(400).json({
          success: false,
          message: 'Cannot enable booking appointment tool: Organization does not have an active calendar connection'
        });
      }
    }

    // Initialize tools array if it doesn't exist
    if (!prompt.tools) {
      prompt.tools = [];
    }

    // Find existing tool or create new one
    const existingToolIndex = prompt.tools.findIndex(
      tool => tool.name.toLowerCase() === toolName.toLowerCase()
    );

    if (enabled) {
      const toolConfig = {
        name: toolName.toLowerCase(),
        metadata: metadata
      };

      if (existingToolIndex >= 0) {
        // Update existing tool
        prompt.tools[existingToolIndex] = toolConfig;
      } else {
        // Add new tool
        prompt.tools.push(toolConfig);
      }
    } else {
      // Remove tool if it exists
      if (existingToolIndex >= 0) {
        prompt.tools.splice(existingToolIndex, 1);
      }
    }

    // Save the updated prompt
    await prompt.save();

    // Update VAPI assistant if applicable
    try {
      await service.updateVapiAssistant(prompt);
    } catch (vapiError) {
      console.warn('Failed to update VAPI assistant:', vapiError.message);
      // Continue execution - tool was saved to database
    }

    res.json({
      success: true,
      message: `Tool ${toolName} ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: {
        promptId: prompt._id,
        tools: prompt.tools
      }
    });

  } catch (error) {
    console.error('Error managing tools:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Manage tools for organization (default prompt users)
 * POST /api/v1/tools/organization/manage
 * Body: {
 *   organizationId: string,
 *   toolName: string,
 *   enabled: boolean,
 *   metadata?: object
 * }
 */
router.post('/organization/manage', async (req, res) => {
  try {
    const { organizationId, toolName, enabled, metadata = {} } = req.body;

    // Validate required fields
    if (!organizationId || !toolName || typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: organizationId, toolName, enabled'
      });
    }

    // Validate toolName
    const validTools = ['endcall', 'bookappointment', 'knowledgebase', 'calltransfer'];
    if (!validTools.includes(toolName.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid tool name. Valid tools: ${validTools.join(', ')}`
      });
    }

    // Find the organization
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Special validation for booking appointment tool
    if (toolName.toLowerCase() === 'bookappointment' && enabled) {
      if (!organization.calendar_connection || !organization.calendar_connection.id_token) {
        return res.status(400).json({
          success: false,
          message: 'Cannot enable booking appointment tool: Organization does not have an active calendar connection'
        });
      }
    }

    // Initialize tools array if it doesn't exist
    if (!organization.tools) {
      organization.tools = [];
    }

    // Find existing tool or create new one
    const existingToolIndex = organization.tools.findIndex(
      tool => tool.name.toLowerCase() === toolName.toLowerCase()
    );

    if (enabled) {
      const toolConfig = {
        name: toolName.toLowerCase(),
        metadata: metadata
      };

      if (existingToolIndex >= 0) {
        // Update existing tool
        organization.tools[existingToolIndex] = toolConfig;
      } else {
        // Add new tool
        organization.tools.push(toolConfig);
      }
    } else {
      // Remove tool if it exists
      if (existingToolIndex >= 0) {
        organization.tools.splice(existingToolIndex, 1);
      }
    }

    // Save the updated organization
    await organization.save();

    res.json({
      success: true,
      message: `Tool ${toolName} ${enabled ? 'enabled' : 'disabled'} successfully for organization`,
      data: {
        organizationId: organization._id,
        tools: organization.tools
      }
    });

  } catch (error) {
    console.error('Error managing organization tools:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Get tools for a specific organization
 * GET /api/v1/tools/organization/:organizationId
 */
router.get('/organization/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    res.json({
      success: true,
      data: {
        organizationId: organization._id,
        tools: organization.tools || []
      }
    });

  } catch (error) {
    console.error('Error getting organization tools:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Get tools for a specific prompt by promptId
 * GET /api/v1/tools/prompt/:promptId?promptType=custom|client
 */
router.get('/prompt/:promptId', async (req, res) => {
  try {
    const { promptId } = req.params;
    const { promptType } = req.query;
    
    if (!promptId) {
      return res.status(400).json({ error: 'Prompt ID is required' });
    }
    
    if (!promptType || !['custom', 'client'].includes(promptType)) {
      return res.status(400).json({ error: 'Valid prompt type is required (custom or client)' });
    }
    
    let prompt;
    if (promptType === 'custom') {
      prompt = await CustomPrompt.findById(promptId);
    } else {
      prompt = await ClientCustomPrompt.findById(promptId);
    }
    
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    
    res.json({ tools: prompt.tools || [] });
  } catch (error) {
    console.error('Error fetching prompt tools:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get tools for a specific prompt
 * GET /api/v1/tools/:promptType/:promptId
 */
router.get('/:promptType/:promptId', async (req, res) => {
  try {
    const { promptType, promptId } = req.params;

    // Validate promptType
    if (!['custom', 'client'].includes(promptType)) {
      return res.status(400).json({
        success: false,
        message: 'promptType must be either "custom" or "client"'
      });
    }

    const Model = promptType === 'custom' ? CustomPrompt : ClientCustomPrompt;
    const prompt = await Model.findById(promptId);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        message: 'Prompt not found'
      });
    }

    res.json({
      success: true,
      data: {
        promptId: prompt._id,
        tools: prompt.tools || []
      }
    });

  } catch (error) {
    console.error('Error getting tools:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * Unified tools management endpoint - supports both promptID and organizationID
 * POST /api/v1/tools/update
 * Body: {
 *   promptId?: string,
 *   organizationId?: string,
 *   promptType?: 'custom' | 'client', // required if using promptId
 *   toolName: string,
 *   action: 'add' | 'remove',
 *   metadata?: object
 * }
 */
router.post('/update', async (req, res) => {
  try {
    const { promptId, organizationId, promptType, toolName, action, metadata = {} } = req.body;

    // Validate that either promptId or organizationId is provided, but not both
    if ((!promptId && !organizationId) || (promptId && organizationId)) {
      return res.status(400).json({
        success: false,
        message: 'Provide either promptId or organizationId, but not both'
      });
    }

    // Validate required fields
    if (!toolName || !action) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: toolName, action'
      });
    }

    // Validate action
    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'action must be either "add" or "remove"'
      });
    }

    // If using promptId, validate promptType
    if (promptId && !promptType) {
      return res.status(400).json({
        success: false,
        message: 'promptType is required when using promptId'
      });
    }

    if (promptType && !['custom', 'client'].includes(promptType)) {
      return res.status(400).json({
        success: false,
        message: 'promptType must be either "custom" or "client"'
      });
    }

    // Validate toolName
    const validTools = ['endcall', 'bookappointment', 'knowledgebase', 'calltransfer'];
    if (!validTools.includes(toolName.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid tool name. Valid tools: ${validTools.join(', ')}`
      });
    }

    const enabled = action === 'add';
    let result;

    if (organizationId) {
      // Handle organization-based tool management
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found'
        });
      }

      // Special validation for booking appointment tool
      if (toolName.toLowerCase() === 'bookappointment' && enabled) {
        if (!organization.calendar_connection || !organization.calendar_connection.id_token) {
          return res.status(400).json({
            success: false,
            message: 'Cannot enable booking appointment tool: Organization does not have an active calendar connection'
          });
        }
      }

      // Initialize tools array if it doesn't exist
      if (!organization.tools) {
        organization.tools = [];
      }

      // Find existing tool or create new one
      const existingToolIndex = organization.tools.findIndex(
        tool => tool.name.toLowerCase() === toolName.toLowerCase()
      );

      if (enabled) {
        const toolConfig = {
          name: toolName.toLowerCase(),
          metadata: metadata
        };

        if (existingToolIndex >= 0) {
          // Update existing tool
          organization.tools[existingToolIndex] = toolConfig;
        } else {
          // Add new tool
          organization.tools.push(toolConfig);
        }
      } else {
        // Remove tool if it exists
        if (existingToolIndex >= 0) {
          organization.tools.splice(existingToolIndex, 1);
        }
      }

      // Save the updated organization
      await organization.save();

      result = {
        success: true,
        message: `Tool ${toolName} ${enabled ? 'added to' : 'removed from'} organization successfully`,
        data: {
          organizationId: organization._id,
          tools: organization.tools
        }
      };
    } else {
      // Handle prompt-based tool management
      let prompt;
      let service;
      let Model;

      // Get the appropriate model and service
      if (promptType === 'custom') {
        Model = CustomPrompt;
        service = customPromptService;
      } else {
        Model = ClientCustomPrompt;
        service = clientCustomPromptService;
      }

      // Find the prompt
      prompt = await Model.findById(promptId);
      if (!prompt) {
        return res.status(404).json({
          success: false,
          message: 'Prompt not found'
        });
      }

      // Special validation for booking appointment tool
      if (toolName.toLowerCase() === 'bookappointment' && enabled) {
        let organizationIdForValidation;
        
        if (promptType === 'custom') {
          // For custom prompts, get organization from mechanic
          const { Mechanic } = require('../models');
          const mechanic = await Mechanic.findById(prompt.mechanicId);
          if (!mechanic) {
            return res.status(404).json({
              success: false,
              message: 'Associated mechanic not found'
            });
          }
          organizationIdForValidation = mechanic.organizationId;
        } else {
          // For client prompts, organization is directly available
          organizationIdForValidation = prompt.organizationId;
        }

        // Check if organization has active calendar connection
        const organization = await Organization.findById(organizationIdForValidation);
        if (!organization || !organization.calendar_connection || 
            !organization.calendar_connection.id_token) {
          return res.status(400).json({
            success: false,
            message: 'Cannot enable booking appointment tool: Organization does not have an active calendar connection'
          });
        }
      }

      // Initialize tools array if it doesn't exist
      if (!prompt.tools) {
        prompt.tools = [];
      }

      // Find existing tool or create new one
      const existingToolIndex = prompt.tools.findIndex(
        tool => tool.name.toLowerCase() === toolName.toLowerCase()
      );

      if (enabled) {
        const toolConfig = {
          name: toolName.toLowerCase(),
          metadata: metadata
        };

        if (existingToolIndex >= 0) {
          // Update existing tool
          prompt.tools[existingToolIndex] = toolConfig;
        } else {
          // Add new tool
          prompt.tools.push(toolConfig);
        }
      } else {
        // Remove tool if it exists
        if (existingToolIndex >= 0) {
          prompt.tools.splice(existingToolIndex, 1);
        }
      }

      // Save the updated prompt
      await prompt.save();

      // Update VAPI assistant if applicable
      try {
        await service.updateVapiAssistant(prompt);
      } catch (vapiError) {
        console.warn('Failed to update VAPI assistant:', vapiError.message);
        // Continue execution - tool was saved to database
      }

      result = {
        success: true,
        message: `Tool ${toolName} ${enabled ? 'added to' : 'removed from'} prompt successfully`,
        data: {
          promptId: prompt._id,
          tools: prompt.tools
        }
      };
    }

    res.json(result);

  } catch (error) {
    console.error('Error in unified tools management:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;