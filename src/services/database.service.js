const MechanicsQueue = require('../models/mechanicsQueue.model');
const Tracking = require('../models/tracking.model');

/**
 * Upload mechanics data to MechanicsQueue collection
 * @param {Array} data - Array of mechanics data
 * @param {string} ticketId - Ticket ID
 * @returns {Promise<Object>} Upload result
 */
async function uploadMechanicsToQueue(data, ticketId) {
  try {
    console.log(`📤 Uploading ${data.length} mechanics to queue for ticket: ${ticketId}`);

    // Check if a document with the given ticketId already exists
    const existingDocument = await MechanicsQueue.findOne({ ticketId });

    if (existingDocument) {
      console.log(`⚠️ Document with ticketId ${ticketId} already exists. Skipping upload...`);
      return `Document with ticketId ${ticketId} already exists. Skipping upload...`;
    } else {
      console.log(`✅ No document found with ticketId ${ticketId}. Creating new document(s)...`);
      
      // Add ticketId to each mechanic record
      const dataWithTicketIds = data.map(item => ({
        ...item,
        ticketId
      }));

      console.log(`💾 Inserting ${dataWithTicketIds.length} mechanics records...`);
      const savedDocuments = await MechanicsQueue.insertMany(dataWithTicketIds, { ordered: false });
      
      console.log(`✅ Successfully uploaded ${savedDocuments.length} mechanics to queue`);
      return savedDocuments;
    }
  } catch (error) {
    console.error('❌ Error uploading mechanics to queue:', error);
    throw error;
  }
}

/**
 * Create tracking record for ticket
 * @param {string} ticketId - Ticket ID
 * @param {number} totalMechanics - Total number of mechanics found
 * @param {Array} allMechanics - Array of all mechanics (first 10)
 * @returns {Promise<Object>} Tracking record
 */
async function createTrackingRecord(ticketId, totalMechanics, allMechanics) {
  try {
    console.log(`📊 Creating tracking record for ticket: ${ticketId}`);

    // Check if tracking record already exists
    const existingTracking = await Tracking.findOne({ ticketId });

    if (existingTracking) {
      console.log(`⚠️ Tracking record for ticket ${ticketId} already exists. Updating...`);
      
      // Update existing record
      existingTracking.totalMechanics = totalMechanics;
      existingTracking.allMechanics = allMechanics.slice(0, 10); // Only store first 10
      existingTracking.lastProcessedAt = new Date();
      
      const updatedRecord = await existingTracking.save();
      console.log(`✅ Updated tracking record for ticket: ${ticketId}`);
      return updatedRecord;
    } else {
      // Create new tracking record
      const trackingData = {
        ticketId,
        totalMechanics,
        calledMechanics: 0,
        foundInterest: false,
        foundInterestTime: null,
        allMechanics: allMechanics.slice(0, 10), // Only store first 10
        lastProcessedAt: new Date()
      };

      const trackingRecord = await Tracking.create(trackingData);
      console.log(`✅ Created tracking record for ticket: ${ticketId}`);
      return trackingRecord;
    }
  } catch (error) {
    console.error('❌ Error creating tracking record:', error);
    throw error;
  }
}

module.exports = {
  uploadMechanicsToQueue,
  createTrackingRecord
}; 