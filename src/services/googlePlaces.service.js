const fetch = require("node-fetch");

/**
 * Search for places using Google Places Text Search API
 * @param {string} textQuery - The search query (e.g., "mechanic in New York")
 * @param {string} apiKey - Google Places API key
 * @param {Object} options - Additional search options (address, radius)
 * @returns {Promise<Array>} Array of places from Google Places API
 */
async function searchPlaces(textQuery, apiKey, options = {}) {
  const url = "https://places.googleapis.com/v1/places:searchText";

  const requestBody = {
    textQuery: textQuery,
    ...(options.radius && {
      locationBias: {
        circle: {
          center: {
            latitude: options.latitude || 0,
            longitude: options.longitude || 0,
          },
          radius: options.radius * 1609.34, // Convert miles to meters
        },
      },
    }),
  };

  try {
    console.log(`🔍 Searching Google Places for: "${textQuery}"`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.rating,places.businessStatus,places.types,places.id,places.location,places.priceLevel,places.currentOpeningHours,places.websiteUri",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (response.ok && data.places) {
      console.log(
        `📍 Found ${data.places.length} places from Google Places API`
      );

      // Transform Google Places data to our enhanced format
      const transformedPlaces = data.places.map((place) => {
        // Determine business type from types array
        const businessType = getBusinessType(place.types || []);

        // Calculate distance if we have coordinates
        let distanceFromLocation = null;
        if (options.latitude && options.longitude && place.location) {
          distanceFromLocation = calculateDistance(
            options.latitude,
            options.longitude,
            place.location.latitude,
            place.location.longitude
          );
        }

        return {
          name: place.displayName?.text || "Unknown Business",
          address: place.formattedAddress || "",
          phoneNumber: place.internationalPhoneNumber || "",
          rating: place.rating || 0,
          businessType: businessType,
          placeId: place.id || "",
          distanceFromLocation: distanceFromLocation
            ? `${distanceFromLocation.toFixed(1)} miles`
            : null,
          priceLevel: place.priceLevel || 0,
          openNow: place.currentOpeningHours?.openNow || false,
          website: place.websiteUri || "",
          // Legacy fields for backward compatibility
          internationalPhoneNumber: place.internationalPhoneNumber || "",
          formattedAddress: place.formattedAddress || "",
          displayName: {
            text: place.displayName?.text || "Unknown Business",
            languageCode: place.displayName?.languageCode || "en",
          },
          hasOnboarded: false,
          firstName: "",
          labour: "",
          source: "google",
        };
      });

      return transformedPlaces;
    } else {
      console.error("❌ Google Places API error:", data);
      return [];
    }
  } catch (error) {
    console.error("❌ Error searching Google Places:", error);
    return [];
  }
}

/**
 * Determine business type from Google Places types array
 * @param {Array} types - Array of place types from Google
 * @returns {string} Business type description
 */
function getBusinessType(types) {
  const typeMapping = {
    car_repair: "Auto Repair",
    gas_station: "Gas Station",
    car_dealer: "Car Dealer",
    locksmith: "Locksmith",
    electrician: "Electrician",
    plumber: "Plumber",
    roofing_contractor: "Roofing Contractor",
    moving_company: "Moving Company",
    storage: "Storage",
    tow_truck_service: "Towing Service",
  };

  // Look for specific service types first
  for (const type of types) {
    if (typeMapping[type]) {
      return typeMapping[type];
    }
  }

  // Check for roadside assistance related terms
  const roadsideTerms = ["towing", "roadside", "emergency", "assistance"];
  for (const type of types) {
    for (const term of roadsideTerms) {
      if (type.toLowerCase().includes(term)) {
        return "Roadside Assistance";
      }
    }
  }

  // Default based on common types
  if (types.includes("establishment")) {
    return "Service Provider";
  }

  return "General Service";
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in miles
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = {
  searchPlaces,
};
