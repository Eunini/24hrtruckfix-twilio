/**
 * Driver Assignment Controller
 * 
 * This controller exposes endpoints for assigning drivers to tickets.
 */

const { assignDriverToTicket, unassignDriverFromTicket, getDriverAssignmentStatus } = require('../services/driver-assignment.service');
const { HTTP_STATUS_CODES } = require('../helper');

/**
 * Assign a driver to a ticket
 * POST /api/v1/tickets/:ticketId/assign
 */
exports.assignDriverToTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { driverId, force } = req.body;
    
    if (!driverId) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: 'Driver ID is required'
      });
    }
    
    const result = await assignDriverToTicket(ticketId, driverId, { force });
    
    if (result.status === 'already_assigned') {
      return res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: 'Driver already assigned to this ticket',
        data: result
      });
    }
    
    if (result.status === 'conflict') {
      return res.status(HTTP_STATUS_CODES.CONFLICT).json({
        success: false,
        message: 'Ticket already assigned to a different driver',
        data: result
      });
    }
    
    if (result.status === 'error') {
      return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: 'Driver successfully assigned to ticket',
      data: result
    });
  } catch (error) {
    console.error('Error in assignDriverToTicket controller:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to assign driver to ticket',
      error: error.message
    });
  }
};

/**
 * Unassign a driver from a ticket
 * POST /api/v1/tickets/:ticketId/unassign
 */
exports.unassignDriverFromTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { force } = req.body;
    
    const result = await unassignDriverFromTicket(ticketId, { force });
    
    if (!result.success) {
      return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: 'Driver successfully unassigned from ticket',
      data: result
    });
  } catch (error) {
    console.error('Error in unassignDriverFromTicket controller:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to unassign driver from ticket',
      error: error.message
    });
  }
};

/**
 * Get driver assignment status for a ticket
 * GET /api/v1/tickets/:ticketId/assignment
 */
exports.getAssignmentStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const result = await getDriverAssignmentStatus(ticketId);
    
    if (!result.success) {
      return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }
    
    return res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getAssignmentStatus controller:', error);
    return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get assignment status',
      error: error.message
    });
  }
};