const Ticket = require('../models/ticket.model');
const { geocodeAddress, reverseGeocodeCoordinates } = require('../services/location.service');
const { getNearbyMechanicsFromDatabase, transformMechanicsData, mergeMechanicsData } = require('../services/mechanics.service');
const { searchPlaces } = require('../services/googlePlaces.service');
const { generateMechanicSearchKeyword } = require('../services/openai.service');
const { uploadMechanicsToQueue, createTrackingRecord } = require('../services/database.service');
const { notifyService } = require('../services/ai/notification');

// Import the enhanced formatAddress function
function formatAddress(address) {
  if (!address) return '';
  
  // If it's a string, just clean up whitespace
  if (typeof address === 'string') {
    return address.replace(/\s+/g, ' ').trim();
  }
  
  // If it's an object with breakdown_address structure
  if (typeof address === 'object') {
    const parts = [];
    
    // Add address line 1 if available
    if (address.address_line_1) {
      parts.push(address.address_line_1.replace(/\s+/g, ' ').trim());
    }
    
    // Add street if different from address_line_1
    if (address.street && address.street !== address.address_line_1) {
      parts.push(address.street.replace(/\s+/g, ' ').trim());
    }
    
    // Add city
    if (address.city) {
      parts.push(address.city.replace(/\s+/g, ' ').trim());
    }
    
    // Add state
    if (address.state) {
      parts.push(address.state.replace(/\s+/g, ' ').trim());
    }
    
    // Add zipcode
    if (address.zipcode) {
      parts.push(address.zipcode.toString().replace(/\s+/g, ' ').trim());
    }
    
    // Join all parts with commas and return
    return parts.filter(part => part.length > 0).join(', ');
  }
  
  return '';
}

/**
 * Receive location data from driver and process mechanic assignment
 */
exports.receiveLocationData = async (req, res) => {
  try {
    const body = req.body;
    const { id, address, Latitude, Longitude } = body;

    console.log('📍 Received location data:', body);

    // STEP 1: Validate required parameters
    const hasCoordinates = Latitude && Longitude && id;
    const hasAddress = id && address;

    if (!hasCoordinates && !hasAddress) {
      return res.status(400).json({
        success: false,
        message: "Either (id, address) or (id, Latitude, Longitude) are required",
        code: "INVALID_PARAMETERS"
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Ticket ID is required",
        code: "MISSING_TICKET_ID"
      });
    }

    // STEP 2: Check if ticket exists
    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
        code: "TICKET_NOT_FOUND"
      });
    }

    // STEP 3: Check if auto_assignment_status is already success or failed
    if (ticket.auto_assignment_status === 'success' || ticket.auto_assignment_status === 'failed') {
      return res.status(409).json({
        success: false,
        message: `This flow has happened before. Status: ${ticket.auto_assignment_status}`,
        code: "FLOW_ALREADY_PROCESSED"
      });
    }

    // STEP 4: Extract breakdown reasons from ticket
    const primaryReason = ticket.breakdown_reason && ticket.breakdown_reason.length > 0 
      ? ticket.breakdown_reason.map(r => r.label || r.key).join(', ')
      : 'mechanical breakdown';
    const secondaryReason = ticket.breakdown_reason_text || '';

    console.log('🔧 Breakdown reasons from ticket:', { primaryReason, secondaryReason });

    let finalLatitude, finalLongitude, finalAddress;

    // STEP 5: Handle address conversion to coordinates
    if (hasAddress && !hasCoordinates) {
      console.log('🔄 Converting address to coordinates...');
      
      const coordinates = await geocodeAddress(address, process.env.GOOGLE_MAPS_API_KEY);
      
      if (!coordinates) {
        // Send email notification about failed address conversion
        try {
          await notifyService({
            ticketId: id,
            clientId: ticket.organization_id,
            functionKey: 'receiveLocationData',
            status: 'error',
            params: { error: 'Failed to get coordinates from address', address },
            shouldThrowError: false
          });
        } catch (notifyError) {
          console.warn('⚠️ Failed to send notification:', notifyError.message);
        }

        return res.status(400).json({
          success: false,
          message: "Failed to get coordinates from address",
          code: "GEOCODING_FAILED"
        });
      }

      finalLatitude = coordinates.lat;
      finalLongitude = coordinates.lng;
      finalAddress = address;
    } else {
      // STEP 6: Handle coordinates conversion to address
      finalLatitude = parseFloat(Latitude);
      finalLongitude = parseFloat(Longitude);

      console.log('🔄 Converting coordinates to address...');
      const reverseGeocodedAddress = await reverseGeocodeCoordinates(
        finalLatitude, 
        finalLongitude, 
        process.env.GOOGLE_MAPS_API_KEY
      );

      finalAddress = reverseGeocodedAddress || address || 'Unknown address';
    }

    // STEP 7: Update ticket with coordinates and address
    const updateData = {
      coord: {
        latitude: finalLatitude.toString(),
        longitude: finalLongitude.toString()
      }
    };

    // Update breakdown_address if we got a new address from reverse geocoding
    if (!hasAddress && finalAddress) {
      updateData.breakdown_address = {
        address_line_1: finalAddress
      };
    }

    await Ticket.findByIdAndUpdate(id, updateData);
    console.log('✅ Updated ticket with coordinates and address');

    // STEP 8: Get updated ticket and format address
    const updatedTicket = await Ticket.findById(id);
    const formattedAddress = formatAddress(updatedTicket.breakdown_address);

    // STEP 9: Find nearby mechanics from database
    console.log('🔍 Searching for nearby mechanics...');
    const nearbyMechanics = await getNearbyMechanicsFromDatabase(finalLongitude, finalLatitude);
    const transformedDbMechanics = transformMechanicsData(nearbyMechanics);

    let allMechanics = transformedDbMechanics;

    // STEP 10: If we have less than 40 mechanics, supplement with Google Places
    if (transformedDbMechanics.length < 40) {
      console.log(`📊 Found ${transformedDbMechanics.length} mechanics from DB. Searching Google Places...`);

      // Generate search keyword using OpenAI with breakdown reasons from ticket
      const searchKeyword = await generateMechanicSearchKeyword(
        primaryReason,
        secondaryReason,
        process.env.OPENAI_API_KEY
      );

      // Search Google Places
      const googleQuery = `${searchKeyword} in ${formattedAddress}`;
      console.log(googleQuery, "googleQuery")
      const googleMechanics = await searchPlaces(googleQuery, process.env.GOOGLE_PLACES_API_KEY);

      // Merge mechanics from both sources
      allMechanics = mergeMechanicsData(transformedDbMechanics, googleMechanics);
    }

    // STEP 11: Check if we found any mechanics
    if (allMechanics.length === 0) {
      console.log('❌ No mechanics found');
      
      // Update ticket status to failed
      await Ticket.findByIdAndUpdate(id, {
        auto_assignment_status: 'failed'
      });

      return res.status(404).json({
        success: false,
        message: "No mechanics found in the area",
        code: "NO_MECHANICS_FOUND"
      });
    }

    // STEP 12: Get first 10 mechanics for processing
    const mechanicsForProcessing = allMechanics.slice(0, 10);

    // STEP 13: Upload mechanics to MechanicsQueue
    await uploadMechanicsToQueue(allMechanics, id);

    // STEP 14: Create tracking record
    await createTrackingRecord(id, allMechanics.length, mechanicsForProcessing);

    console.log(`✅ Successfully processed location data for ticket ${id}`);
    console.log(`📊 Found ${allMechanics.length} total mechanics, processing first 10`);
    console.log(`🔧 Used breakdown reasons: Primary: "${primaryReason}", Secondary: "${secondaryReason}"`);

    res.status(200).json({
      success: true,
      message: "Location data processed successfully",
      data: {
        ticketId: id,
        coordinates: { latitude: finalLatitude, longitude: finalLongitude },
        address: formattedAddress,
        totalMechanics: allMechanics.length,
        mechanicsToProcess: mechanicsForProcessing.length,
        breakdownReasons: {
          primary: primaryReason,
          secondary: secondaryReason
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in receiveLocationData:', error);

    // Send error notification if we have a ticket ID
    if (req.body.id) {
      try {
        await notifyService({
          ticketId: req.body.id,
          clientId: null,
          functionKey: 'receiveLocationData',
          status: 'error',
          params: { error: error.message },
          shouldThrowError: false
        });
      } catch (notifyError) {
        console.warn('⚠️ Failed to send error notification:', notifyError.message);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message,
      code: "INTERNAL_SERVER_ERROR"
    });
  }
}; 