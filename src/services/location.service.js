const fetch = require("node-fetch");

/**
 * Convert address to latitude and longitude using Google Geocoding API
 * @param {string} address - The address to geocode
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<{lat: number, lng: number} | null>} Coordinates or null if failed
 */
async function geocodeAddress(address, apiKey) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
      console.log("📍 Geocoding successful:", data);
      const result = data.results[0];
      const location = result.geometry.location;
      return location ? location : null;
    } else {
      console.log("❌ Geocoding failed:", data);
      console.error(`Geocoding lookup failed with status: ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error("❌ Geocoding error:", error);
    return null;
  }
}

/**
 * Convert latitude and longitude to address using Google Reverse Geocoding API
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @param {string} apiKey - Google Maps API key
 * @returns {Promise<string | null>} Formatted address or null if failed
 */
async function reverseGeocodeCoordinates(
  latitude,
  longitude,
  apiKey,
  getFullResult = false
) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
      console.log("🏠 Reverse geocoding successful:", data);
      // Assuming the first result is the most relevant one
      const result = data.results[0];
      const street = result.formatted_address;
      return getFullResult ? result : street ? street : null;
    } else {
      console.log("❌ Reverse geocoding failed:", data);
      console.error(
        `Geocoding reverse lookup failed with status: ${data.status}`
      );
      return null;
    }
  } catch (error) {
    console.error("❌ Reverse geocoding error:", error);
    return null;
  }
}

module.exports = {
  geocodeAddress,
  reverseGeocodeCoordinates,
};
