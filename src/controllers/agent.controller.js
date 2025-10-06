const { createNewAgent, getAllAgents, getAgentDetailsById, updateAgent, deleteAgentById, disableAgent, userAgents } = require('../models/mongo/functions/agent');
const { HTTP_STATUS_CODES } = require('../helper');

// Create a new agent
exports.createAgent = async (req, res) => {
  try {
    const userId = req.user.userId; // From auth middleware
    
    const result = await createNewAgent(req.body, userId);
    res.status(HTTP_STATUS_CODES.CREATED).json({
      status: HTTP_STATUS_CODES.CREATED,
      message: "Agent created successfully",
      data: result
    });
  } catch (error) {
    console.error('createAgent error:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      message: error.message 
    });
  }
};

// Get all agents with pagination and filters
exports.getAllAgents = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", sortField = "createdAt", sort = -1 } = req.query;
    const userId = req.user.userId;
    const orgId = req.user.organizationId

    const result = await getAllAgents(
      userId,
      parseInt(page),
      parseInt(limit),
      search,
      sortField,
      parseInt(sort),
      orgId
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      status: HTTP_STATUS_CODES.OK,
      data: result
    });
  } catch (error) {
    console.error('getAllAgents error:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      message: error.message 
    });
  }
};

exports.getUserAgents = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", sortField = "createdAt", sort = -1 } = req.query;
    const userId = req.user.userId;

    const result = await userAgents(
      userId,
      parseInt(page),
      parseInt(limit),
      search,
      sortField,
      parseInt(sort)
    );

    res.status(HTTP_STATUS_CODES.OK).json({
      status: HTTP_STATUS_CODES.OK,
      data: result
    });
  } catch (error) {
    console.error('getAllAgents error:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      message: error.message 
    });
  }
};

// Get agent by ID
exports.getAgentById = async (req, res) => {
  try {
    const agent = await getAgentDetailsById(req.params.id);

    if (!agent) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
        status: HTTP_STATUS_CODES.NOT_FOUND,
        message: 'Agent not found' 
      });
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      status: HTTP_STATUS_CODES.OK,
      data: agent
    });
  } catch (error) {
    console.error('getAgentById error:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      message: error.message 
    });
  }
};

// Update agent
exports.updateAgent = async (req, res) => {
  try {
    const userId = req.user.userId;
    const agent = await updateAgent(req.body, req.params.id, userId);

    if (!agent) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
        status: HTTP_STATUS_CODES.NOT_FOUND,
        message: 'Agent not found' 
      });
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      status: HTTP_STATUS_CODES.OK,
      message: "Agent updated successfully",
      data: agent
    });
  } catch (error) {
    console.error('updateAgent error:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      message: error.message 
    });
  }
};

// Delete agent
exports.deleteAgent = async (req, res) => {
  console.log(req.user)
  try {

    const agentId = req.params.id
    const userId = req.user.userId

    const agent = await deleteAgentById(agentId, userId);

    if (!agent) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
        status: HTTP_STATUS_CODES.NOT_FOUND,
        message: 'Agent not found' 
      });
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      status: HTTP_STATUS_CODES.OK,
      message: 'Agent deleted successfully'
    });
  } catch (error) {
    console.error('deleteAgent error:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      message: error.message 
    });
  }
};

// Change agent status
exports.changeAgentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const agent = await disableAgent(req.params.id, status);

    if (!agent) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({ 
        status: HTTP_STATUS_CODES.NOT_FOUND,
        message: 'Agent not found' 
      });
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      status: HTTP_STATUS_CODES.OK,
      message: `Agent status changed to ${status} successfully`,
      data: agent
    });
  } catch (error) {
    console.error('changeAgentStatus error:', error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({ 
      status: HTTP_STATUS_CODES.BAD_REQUEST,
      message: error.message 
    });
  }
}; 