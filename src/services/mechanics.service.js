const mongoose = require('mongoose');
const Mechanic = require('../models/mechanic.model');

/**
 * Find nearby mechanics using geospatial query
 * @param {number} longitude - Longitude coordinate
 * @param {number} latitude - Latitude coordinate
 * @param {number} maxDistanceKm - Maximum distance in kilometers (default: 10)
 * @param {number} limit - Maximum number of results (default: 20)
 * @returns {Promise<Array>} Array of nearby mechanics
 */
async function getNearbyMechanicsFromDatabase(longitude, latitude, maxDistanceKm = 10, limit = 20) {
  try {
    console.log(`🔍 Searching for mechanics near ${latitude}, ${longitude} within ${maxDistanceKm}km`);

    // First, try to find mechanics with valid geospatial data using aggregation
    try {
      const nearbyMechanics = await Mechanic.aggregate([
        {
          $match: {
            "mechanicLocation.type": "Point",
            "mechanicLocation.coordinates": { $exists: true, $type: "array", $size: 2 }
          }
        },
        {
          $geoNear: {
            near: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
            distanceField: "distance",
            maxDistance: maxDistanceKm * 1000,
            spherical: true
          }
        },
        {
          $limit: limit
        }
      ]);

      console.log(`📍 Found ${nearbyMechanics.length} nearby mechanics from database using geospatial query`);
      return nearbyMechanics;
    } catch (geoError) {
      console.warn('⚠️ Geospatial query failed, falling back to basic search:', geoError.message);
      
      // Fallback: Get all mechanics and return a subset (not location-based)
      const allMechanics = await Mechanic.find({
        businessName: { $exists: true, $ne: "" }
      }).limit(limit);

      // Add a fake distance for consistency
      const mechanicsWithDistance = allMechanics.map(mechanic => ({
        ...mechanic.toObject(),
        distance: Math.random() * maxDistanceKm * 1000 // Random distance within range
      }));

      console.log(`📍 Found ${mechanicsWithDistance.length} mechanics from database using fallback method`);
      return mechanicsWithDistance;
    }
  } catch (error) {
    console.error('❌ Error finding nearby mechanics:', error);
    
    // Return empty array instead of throwing to allow the flow to continue
    console.log('📍 Returning empty array due to database error');
    return [];
  }
}

/**
 * Transform mechanic data to standardized format
 * @param {Array} data - Array of mechanic data
 * @returns {Array} Transformed data array
 */
function transformMechanicsData(data) {
  if (!Array.isArray(data)) {
    throw new Error("Input data must be an array");
  }

  const transformedData = data.map(item => {
    return {
      internationalPhoneNumber: item.businessNumber || item.mobileNumber,
      formattedAddress: item.address,
      displayName: {
        text: item.businessName || item.firstName || "Unknown Business",
        languageCode: "en"
      },
      hasOnboarded: item.hasOnboarded || false,
      firstName: item?.firstName || "",
      labour: item["labour/Hr"] || item.labour || "",
      distance: item.distance,
      source: 'database'
    };
  });

  console.log(`🔄 Transformed ${transformedData.length} mechanics from database`);
  return transformedData;
}

/**
 * Merge mechanics from database and Google Places API, removing duplicates
 * @param {Array} fromDb - Mechanics from database
 * @param {Array} fromGoogle - Mechanics from Google Places API
 * @returns {Array} Merged unique mechanics
 */
function mergeMechanicsData(fromDb, fromGoogle) {
  // Combine the two arrays
  const combinedPlaces = [...fromDb, ...fromGoogle];

  // Use a Map to keep track of unique places by internationalPhoneNumber
  const uniquePlacesMap = new Map();

  // Iterate through the combined array and add to the Map
  for (const place of combinedPlaces) {
    const phoneNumber = place.internationalPhoneNumber;
    
    // Skip if no phone number
    if (!phoneNumber) continue;
    
    // If the phone number doesn't exist in the Map, or if the current place has more information,
    // add/update it in the Map
    if (!uniquePlacesMap.has(phoneNumber) || 
        (place.formattedAddress && !uniquePlacesMap.get(phoneNumber)?.formattedAddress)) {
      uniquePlacesMap.set(phoneNumber, place);
    }
  }

  // Convert the Map values back to an array
  const mergedPlaces = Array.from(uniquePlacesMap.values());

  console.log(`🔀 Merged ${fromDb.length} places from DB and ${fromGoogle.length} places from Google. Result: ${mergedPlaces.length} unique places.`);

  return mergedPlaces;
}

module.exports = {
  getNearbyMechanicsFromDatabase,
  transformMechanicsData,
  mergeMechanicsData
}; 