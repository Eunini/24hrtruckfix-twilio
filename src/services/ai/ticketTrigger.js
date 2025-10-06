const axios = require('axios');
const { outboundService } = require('./outbound');

/**
 * Service function to trigger ticket processing
 * @param {Object} ticket - The ticket object to process
 * @param {boolean} [shouldThrowError=true] - Whether to throw errors or return error status
 * @returns {Promise<Object>} The processing result
 */
async function sendNewTicketTriggerService(ticket, shouldThrowError = true) {
  if (!ticket) {
    const error = new Error('Ticket object is required');
    if (shouldThrowError) throw error;
    return {
      success: false,
      message: error.message,
      code: 'INVALID_TICKET',
      data: null
    };
  }

  console.log('🚀 [sendNewTicketTrigger] processing ticket:', ticket._id);

  try {
    // Call the outbound service directly with shouldThrowError option
    const result = await outboundService(ticket._id?.toString(), shouldThrowError);
    console.log('✅ outboundService result:', result);

    // Handle graceful stops and errors
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      data: result
    };

  } catch (error) {
    console.error('❌ sendNewTicketTrigger error:', error);
    if (shouldThrowError) {
      throw new Error(`Failed to process ticket: ${error.message}`);
    }
    return {
      success: false,
      message: `Failed to process ticket: ${error.message}`,
      code: error.code || 'TRIGGER_ERROR',
      data: { ticketId: ticket._id }
    };
  }
}

// Express route handler that uses the service function
async function sendNewTicketTriggerHandler(req, res) {
  try {
    // For ticket creation, we don't want to throw errors
    const result = await sendNewTicketTriggerService(req.body, false);
    // Use 202 status for graceful stops (when we have a code), 200 for success
    res.status(result.code ? 202 : 200).json(result);
  } catch (error) {
    console.error('❌ sendNewTicketTrigger handler error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal Server Error'
    });
  }
}

module.exports = {
  sendNewTicketTrigger: sendNewTicketTriggerHandler, // For backward compatibility
  sendNewTicketTriggerService // The new service function
};