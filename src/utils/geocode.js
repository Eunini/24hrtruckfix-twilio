const axios = require("axios")

/**
 * Geocode an address string to { latitude: string, longitude: string }.
 * Uses Google Geocoding API. Requires process.env.GEOCODING_API_KEY.
 * Returns null if geocoding fails or no result.
 */
async function geocodeAddress(addressString) {
  if (
    !addressString ||
    typeof addressString !== "string" ||
    !addressString.trim()
  ) {
    return null;
  }
  const apiKey =
    process.env.GOOGLE_PLACE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn("GEOCODING_API_KEY not set; skipping geocoding");
    return null;
  }
  try {
    const encoded = encodeURIComponent(addressString);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`;
    const resp = await axios.get(url, { timeout: 5000 });
    if (
      resp.data.status === "OK" &&
      Array.isArray(resp.data.results) &&
      resp.data.results.length > 0
    ) {
      const location = resp.data.results[0].geometry.location;
      // Return as strings to match your ticket.coordSchema expecting Strings
      return {
        latitude: location.lat.toString(),
        longitude: location.lng.toString(),
      };
    } else {
      console.warn(
        "Geocoding API returned no results:",
        resp.data.status,
        resp.data.error_message
      );
      return null;
    }
  } catch (err) {
    console.error("Error during geocoding request:", err.message || err);
    return null;
  }
}

/**
 * Given two lat/lng pairs (as strings), call Google Distance Matrix
 * to get driving duration. Returns { text, seconds } or null.
 * origin - mechanic coords, destination - ticket coords
 */
async function getDrivingTime(origin, destination) {
  const apiKey =
    process.env.GOOGLE_PLACE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_MAPS_API_KEY not set; skipping distance request");
    return null;
  }

  const originParam = `${origin.latitude},${origin.longitude}`;
  const destParam = `${destination.latitude},${destination.longitude}`;

  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${encodeURIComponent(originParam)}` +
    `&destinations=${encodeURIComponent(destParam)}` +
    `&mode=driving` +
    `&key=${apiKey}`;

  try {
    const resp = await axios.get(url, { timeout: 5000 });
    const data = resp.data;
    if (
      data.status === "OK" &&
      Array.isArray(data.rows) &&
      data.rows[0]?.elements?.[0]?.status === "OK"
    ) {
      const element = data.rows[0].elements[0];
      console.log(element.duration);
      return {
        text: element.duration.text,
        seconds: element.duration.value,
      };
    }
    console.warn(
      "Distance Matrix API no result:",
      data.status,
      data.error_message
    );
    return null;
  } catch (err) {
    console.error("Error fetching driving time:", err.message || err);
    return null;
  }
}

/**
 * Given an origin and one destination (lat/lng strings),
 * call Google Distance Matrix to get driving distance in miles.
 * Returns string like "8.12 miles" or null.
 */
async function getDrivingDistanceMiles(origin, destination) {
  const apiKey = process.env.GOOGLE_PLACE_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_MAPS_API_KEY not set; skipping distance request");
    return null;
  }

  if (!origin || !destination) return null;

  const originParam = `${origin.latitude},${origin.longitude}`;
  const destParam = `${destination.latitude},${destination.longitude}`;

  let url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${encodeURIComponent(originParam)}` +
    `&destinations=${encodeURIComponent(destParam)}` +
    `&mode=driving` +
    `&units=imperial` +
    `&key=${apiKey}`;

  try {
    const resp = await axios.get(url, { timeout: 8000 });
    const data = resp.data;

    if (
      data?.status === "OK" &&
      Array.isArray(data.rows) &&
      data.rows[0] &&
      Array.isArray(data.rows[0].elements) &&
      data.rows[0].elements[0]
    ) {
      const el = data.rows[0].elements[0];
      if (!el || el.status !== "OK" || !el.distance) return null;

      // Google gives meters, so convert to miles safely
      const meters = Number(el.distance.value);
      const miles = meters / 1609.344;

      return `${miles.toFixed(2)} miles`;
    }

    console.warn("Distance Matrix API no result:", data?.status, data?.error_message);
    return null;
  } catch (err) {
    console.error("Error fetching distance matrix:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

module.exports = {
   geocodeAddress, 
   getDrivingTime, 
   getDrivingDistanceMiles 
  };
