/**
 * Driver Assignment Service
 * 
 * This service provides a robust, idempotent mechanism for assigning drivers to tickets.
 * It ensures that:
 * - Each assignment operation is idempotent (safe to retry without duplicates)
 * - Failed assignments are retried with backoff
 * - Assignment state is tracked and logged
 * - Conflicts are detected and resolved
 */

const mongoose = require('mongoose');
const Ticket = require('../models/ticket.model');
const Mechanic = require('../models/mechanic.model');
const Tracking = require('../models/tracking.model');
const { getDrivingTime } = require('../utils/geocode');
const { notifyService } = require('./ai/notification');

// Constants for retry configuration
const MAX_ASSIGNMENT_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 2000;
const ASSIGNMENT_LOCK_EXPIRY_SEC = 60;

/**
 * Assign a driver to a ticket with idempotent behavior
 * 
 * @param {string} ticketId - ID of the ticket
 * @param {string} driverId - ID of the driver to assign
 * @param {Object} options - Optional parameters
 * @param {boolean} options.force - Whether to force assignment even if already assigned
 * @param {number} options.maxRetries - Maximum number of retries on failure
 * @returns {Promise<Object>} Result object with success status and details
 */
async function assignDriverToTicket(ticketId, driverId, options = {}) {
  const { 
    force = false, 
    maxRetries = MAX_ASSIGNMENT_RETRIES 
  } = options;
  
  // Validate input
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new Error('Invalid ticket ID format');
  }
  
  if (!mongoose.Types.ObjectId.isValid(driverId)) {
    throw new Error('Invalid driver ID format');
  }
  
  console.log(`🔄 Attempting to assign driver ${driverId} to ticket ${ticketId}`);
  
  // Use MongoDB transaction for atomic operations
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // 1. Find ticket and driver with locking (using the transaction)
    const ticket = await Ticket.findById(ticketId).session(session);
    if (!ticket) {
      await session.abortTransaction();
      session.endSession();
      throw new Error(`Ticket ${ticketId} not found`);
    }
    
    const driver = await Mechanic.findById(driverId).session(session);
    if (!driver) {
      await session.abortTransaction();
      session.endSession();
      throw new Error(`Driver ${driverId} not found`);
    }
    
    // 2. Check if ticket already has an assigned driver (idempotency check)
    if (ticket.assigned_subcontractor && !force) {
      // If already assigned to the requested driver, return success (idempotent)
      if (ticket.assigned_subcontractor.toString() === driverId.toString()) {
        await session.abortTransaction();
        session.endSession();
        console.log(`✅ Driver ${driverId} already assigned to ticket ${ticketId}`);
        return {
          success: true,
          message: 'Driver already assigned to this ticket',
          status: 'already_assigned',
          ticketId,
          driverId
        };
      }
      
      // If assigned to a different driver, handle conflict
      await session.abortTransaction();
      session.endSession();
      console.warn(`⚠️ Ticket ${ticketId} already assigned to different driver ${ticket.assigned_subcontractor}`);
      return {
        success: false,
        message: 'Ticket already assigned to a different driver',
        status: 'conflict',
        ticketId,
        driverId,
        currentAssignedDriver: ticket.assigned_subcontractor
      };
    }
    
    // 3. Update ticket with new driver assignment
    ticket.assigned_subcontractor = driverId;
    ticket.status = 'assigned';
    ticket.auto_assignment_status = 'success';
    ticket.auto_assigned_at = new Date();
    ticket.auto_assigned_by = 'system';
    
    // 4. Calculate and update ETA if coordinates are available
    if (ticket.coord && driver.mechanicLocationLatitude && driver.mechanicLocationLongitude) {
      const origin = {
        latitude: driver.mechanicLocationLatitude,
        longitude: driver.mechanicLocationLongitude
      };
      
      const destination = {
        latitude: ticket.coord.latitude,
        longitude: ticket.coord.longitude
      };
      
      try {
        const travel = await getDrivingTime(origin, destination);
        const seconds = Number(travel.seconds);
        const nowMs = Date.now();
        const etaMs = nowMs + seconds * 1000;
        const etaDate = new Date(etaMs);
        ticket.estimated_eta = etaDate;
      } catch (etaError) {
        console.warn(`⚠️ Failed to calculate ETA for ticket ${ticketId}:`, etaError.message);
        // Continue assignment even if ETA calculation fails
      }
    }
    
    // 5. Save ticket changes
    await ticket.save({ session });
    
    // 6. Update tracking record if it exists
    const tracking = await Tracking.findOne({ ticketId }).session(session);
    if (tracking) {
      tracking.foundInterest = true;
      tracking.foundInterestTime = new Date();
      await tracking.save({ session });
    }
    
    // 7. Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    // 8. Send notification about successful assignment
    try {
      await notifyService({
        ticketId,
        clientId: ticket.organization_id,
        functionKey: 'assignDriverToTicket',
        status: 'success',
        params: { driverId },
        shouldThrowError: false
      });
    } catch (notifyError) {
      // Log but don't fail the whole operation if notification fails
      console.warn(`⚠️ Failed to send assignment notification:`, notifyError.message);
    }
    
    console.log(`✅ Successfully assigned driver ${driverId} to ticket ${ticketId}`);
    return {
      success: true,
      message: 'Driver successfully assigned to ticket',
      status: 'assigned',
      ticketId,
      driverId,
      eta: ticket.estimated_eta
    };
  } catch (error) {
    // Abort transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error(`❌ Error assigning driver ${driverId} to ticket ${ticketId}:`, error.message);
    
    // Implement retry with exponential backoff
    if (maxRetries > 0) {
      const retryDelay = INITIAL_RETRY_DELAY_MS * Math.pow(2, MAX_ASSIGNMENT_RETRIES - maxRetries);
      console.log(`⏳ Retrying assignment in ${retryDelay}ms (${maxRetries} retries left)...`);
      
      return new Promise(resolve => {
        setTimeout(async () => {
          try {
            const result = await assignDriverToTicket(ticketId, driverId, {
              force,
              maxRetries: maxRetries - 1
            });
            resolve(result);
          } catch (retryError) {
            resolve({
              success: false,
              message: `Assignment failed after retries: ${retryError.message}`,
              status: 'error',
              error: retryError.message,
              ticketId,
              driverId
            });
          }
        }, retryDelay);
      });
    }
    
    // All retries failed
    return {
      success: false,
      message: `Failed to assign driver: ${error.message}`,
      status: 'error',
      error: error.message,
      ticketId,
      driverId
    };
  }
}

/**
 * Unassign a driver from a ticket
 * 
 * @param {string} ticketId - ID of the ticket
 * @param {Object} options - Optional parameters
 * @param {boolean} options.force - Whether to force unassignment
 * @returns {Promise<Object>} Result object with success status and details
 */
async function unassignDriverFromTicket(ticketId, options = {}) {
  const { force = false } = options;
  
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new Error('Invalid ticket ID format');
  }
  
  try {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }
    
    if (!ticket.assigned_subcontractor && !force) {
      return {
        success: true,
        message: 'Ticket already has no assigned driver',
        status: 'already_unassigned',
        ticketId
      };
    }
    
    const previousDriver = ticket.assigned_subcontractor;
    ticket.assigned_subcontractor = null;
    ticket.auto_assignment_status = null;
    
    await ticket.save();
    
    console.log(`✅ Successfully unassigned driver from ticket ${ticketId}`);
    return {
      success: true,
      message: 'Driver successfully unassigned from ticket',
      status: 'unassigned',
      ticketId,
      previousDriver
    };
  } catch (error) {
    console.error(`❌ Error unassigning driver from ticket ${ticketId}:`, error.message);
    return {
      success: false,
      message: `Failed to unassign driver: ${error.message}`,
      status: 'error',
      error: error.message,
      ticketId
    };
  }
}

/**
 * Get assignment status for a ticket
 * 
 * @param {string} ticketId - ID of the ticket
 * @returns {Promise<Object>} Assignment status details
 */
async function getDriverAssignmentStatus(ticketId) {
  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new Error('Invalid ticket ID format');
  }
  
  try {
    const ticket = await Ticket.findById(ticketId)
      .populate('assigned_subcontractor')
      .lean();
      
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }
    
    let driverDetails = null;
    if (ticket.assigned_subcontractor) {
      const driver = ticket.assigned_subcontractor;
      driverDetails = {
        id: driver._id,
        name: driver.businessName || `${driver.firstName} ${driver.lastName}`,
        phone: driver.businessNumber || driver.mobileNumber,
        location: {
          latitude: driver.mechanicLocationLatitude,
          longitude: driver.mechanicLocationLongitude
        }
      };
    }
    
    return {
      success: true,
      ticketId,
      status: ticket.status,
      assignmentStatus: ticket.auto_assignment_status,
      assignedAt: ticket.auto_assigned_at,
      assignedBy: ticket.auto_assigned_by,
      estimatedEta: ticket.estimated_eta,
      driver: driverDetails,
      isAssigned: Boolean(ticket.assigned_subcontractor)
    };
  } catch (error) {
    console.error(`❌ Error getting assignment status for ticket ${ticketId}:`, error.message);
    return {
      success: false,
      message: `Failed to get assignment status: ${error.message}`,
      status: 'error',
      error: error.message,
      ticketId
    };
  }
}

module.exports = {
  assignDriverToTicket,
  unassignDriverFromTicket,
  getDriverAssignmentStatus
};