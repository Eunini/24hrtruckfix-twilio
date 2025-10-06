require("dotenv").config();
const mongoose = require("mongoose");
const { MongoClient, ObjectId } = require("mongodb");
const MechanicModel = require("../models/mechanic.model"); 
const { geocodeAddress } = require("./geocode"); 
const mongoUri = process.env.MONGODB_URI;
const DEFAULT_COUNTRY = "USA";
const GEOCODE_DELAY_MS = parseInt("100", 10);
const BATCH_SIZE = parseInt("1000", 10);

if (!mongoUri) {
  console.error("MONGODB_URI not set in environment");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect();
  console.log("Connected to MongoDB via native MongoClient");

  const useMongooseForUpdate = false;
  if (useMongooseForUpdate) {
    mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Mongoose connected");
  }

  const db = client.db(); 
  const mechanicsCol = db.collection("mechanics");

  let page = 0;
  while (true) {
    const mechanics = await mechanicsCol
      .find({})
      .skip(page * BATCH_SIZE)
      .limit(BATCH_SIZE)
      .toArray();
    if (!mechanics.length) {
      console.log("No more mechanics to process; exiting batch loop");
      break;
    }
    console.log(`Processing batch ${page + 1}, ${mechanics.length} mechanics`);

    for (const mech of mechanics) {
        if (
        mech.mechanicLocation?.coordinates?.length === 2 &&
        typeof mech.mechanicLocationLatitude === "number" &&
        typeof mech.mechanicLocationLongitude === "number"
        ) {
            console.log(`Skipping mechanic ${mech._id}; already geocoded`);
            continue;
        }

      const normalized = {};
      for (const [rawKey, value] of Object.entries(mech)) {
        const keyTrim = rawKey.trim();
        normalized[keyTrim] = value;
      }
      const parts = [];
      const streetKeys = ["streetAddress", "street_address", "address", "street"];
      for (const k of streetKeys) {
        if (
          typeof normalized[k] === "string" &&
          normalized[k].trim()
        ) {
          parts.push(normalized[k].trim());
          break;
        }
      }
      if (
        typeof normalized.city === "string" &&
        normalized.city.trim()
      ) {
        parts.push(normalized.city.trim());
      }
      let stateVal = null;
      if (
        typeof normalized.stateRegion === "string" &&
        normalized.stateRegion.trim()
      ) {
        stateVal = normalized.stateRegion.trim();
      } else if (
        typeof normalized.state === "string" &&
        normalized.state.trim()
      ) {
        stateVal = normalized.state.trim();
      }
      if (stateVal) {
        parts.push(stateVal);
      }
      if (
        typeof normalized.postalCode === "string" &&
        normalized.postalCode.trim()
      ) {
        parts.push(normalized.postalCode.trim());
      } else if (
        typeof normalized.postalCode === "string" && 
        normalized.postalCode.trim()
      ) {
        parts.push(normalized.postalCode.trim());
      } else if (
        typeof normalized.zipcode === "string" &&
        normalized.zipcode.trim()
      ) {
        parts.push(normalized.zipcode.trim());
      }
      let countryVal = null;
      if (
        typeof normalized.country === "string" &&
        normalized.country.trim()
      ) {
        countryVal = normalized.country.trim();
      } else if (
        typeof normalized.countryRegion === "string" &&
        normalized.countryRegion.trim()
      ) {
        countryVal = normalized.countryRegion.trim();
      }
      if (countryVal) {
        parts.push(countryVal);
      } else if (stateVal && /^[A-Za-z]{2}$/.test(stateVal)) {
        parts.push(DEFAULT_COUNTRY);
      }

      const addressString = parts.join(", ").trim();
      if (!addressString) {
        console.warn(
          `No address parts for mechanic ${mech._id?.toString() || "<unknown>"}; parts array empty, skipping`
        );
        continue;
      }

      try {
        const coord = await geocodeAddress(addressString);
        if (coord && coord.latitude != null && coord.longitude != null) {
          const latNum = parseFloat(coord.latitude);
          const lngNum = parseFloat(coord.longitude);
          if (!isNaN(latNum) && !isNaN(lngNum)) {
            
            await mechanicsCol.updateOne(
              { _id: mech._id instanceof ObjectId ? mech._id : new ObjectId(mech._id) },
              {
                $set: {
                  mechanicLocation: {
                    type: "Point",
                    coordinates: [lngNum, latNum],
                  },
                  mechanicLocationLatitude: coord.latitude,
                  mechanicLocationLongitude: coord.longitude,
                },
              }
            );
            console.log(`Updated coords for mechanic ${mech._id}`);
          } else {
            console.warn(
              `Geocode returned invalid lat/lng for ${mech._id}:`,
              coord
            );
          }
        } else {
          console.warn(
            `Failed geocode (no result) for mechanic ${mech._id}, address="${addressString}"`
          );
        }
      } catch (err) {
        console.error(`Error geocoding mechanic ${mech._id}:`, err);
      }

      await new Promise((r) => setTimeout(r, GEOCODE_DELAY_MS));
    }

    page += 1;
  }

  console.log("Batch geocoding completed");
  await client.close();
  console.log("MongoClient connection closed");
  if (useMongooseForUpdate) {
    await mongoose.disconnect();
    console.log("Mongoose disconnected");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Batch error:", err);
  process.exit(1);
});
