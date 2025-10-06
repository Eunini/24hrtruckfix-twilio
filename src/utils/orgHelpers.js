const mongoose = require("mongoose");
const Organization = require("../models/organization.model");

// Fetch an organization's mechanic-related permission flags.
async function getMechanicPermissions(orgId) {

  if (!mongoose.Types.ObjectId.isValid(orgId)) {
    throw new Error("Invalid organization ID");
  }

  const org = await Organization.findById(orgId).lean();

  if (!org) {
    throw new Error("Organization not found");
  }

  const perms = org.permissions || {};

  return {
    primaryMechanic: Boolean(perms.primaryMechanic),
    secondaryMechanic: Boolean(perms.secondaryMechanic),
    allMechanics: Boolean(perms.allMechanics),
  };
}

async function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    function toRad(x) { return x * Math.PI / 180; }
    const R = 6371e3;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  

module.exports = { getMechanicPermissions, haversineDistanceMeters };