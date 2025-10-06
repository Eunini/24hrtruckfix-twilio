const AICallActivityModel = require("../../ai-call-activity.model");
const {
  Types: { ObjectId },
} = require("mongoose");

/**
 * Get all AI activities with pagination and filtering
 */
exports.getAllAIActivities = async (
  page = 1,
  limit = 10,
  search = "",
  sortField = "recorded_time",
  sort = -1,
  organization_id = null,
  call_type = null
) => {
  try {x
    const query = {};

    // Add filters if provided
    if (organization_id) {
      query.organization_id = ObjectId.isValid(organization_id)
        ? new ObjectId(organization_id)
        : organization_id;
    }

    if (call_type) {
      query.call_type = call_type;
    }

    // Add search functionality
    if (search.trim()) {
      const searchTerms = search.split(" ").filter(Boolean);
      query.$or = [];

      searchTerms.forEach((term) => {
        // if (ObjectId.isValid(term)) {
        //   query.$or.push({ _id: new ObjectId(term) });
        //   query.$or.push({ call_id: term });
        // }

        // query.$or.push({ call_id: { $regex: term, $options: "i" } });
        // query.$or.push({ number: { $regex: term, $options: "i" } });
        query.$or.push({ call_type: { $regex: term, $options: "i" } });

        const parsedDate = new Date(term);
        if (!isNaN(parsedDate.getTime())) {
          query.$or.push({
            recorded_time: {
              $gte: new Date(parsedDate.setHours(0, 0, 0, 0)),
              $lt: new Date(parsedDate.setHours(23, 59, 59, 999)),
            },
          });
        }
      });
    }

    const activities = await AICallActivityModel.paginate(query, {
      page,
      limit,
      sort: { [sortField]: Number(sort) },
      populate: {
        path: "organization_id",
        select:
          "companyName companyWebsite businessEntityType organization_type",
      },
      lean: true,
    });

    return activities;
  } catch (ex) {
    console.error("❌ Exception in getAllAIActivities:", ex);
    return null;
  }
};

/**
 * Check if an activity with the specified call_id exists
 */
exports.checkActivityExists = async (call_id) => {
  try {
    const count = await AICallActivityModel.countDocuments({ call_id });
    return count > 0;
  } catch (ex) {
    console.error("❌ Exception in checkActivityExists:", ex);
    throw ex;
  }
};

/**
 * Create a new AI activity record
 */
exports.createActivity = async (activityData) => {
  try {
    // Check required fields
    const requiredFields = [
      "call_id",
      "organization_id",
      "call_type",
      "number",
    ];
    for (const field of requiredFields) {
      if (!activityData[field]) throw new Error(`${field} is required`);
    }

    // Check if already exists
    const exists = await this.checkActivityExists(activityData.call_id);
    if (exists) {
      throw new Error("Activity with this call_id already exists");
    }

    // Create the new activity
    const newActivity = new AICallActivityModel({
      ...activityData,
      recorded_time: activityData.recorded_time || new Date(),
    });

    await newActivity.save();
    console.log(
      `✅ Created new AI activity with call_id: ${activityData.call_id}`
    );

    return newActivity;
  } catch (ex) {
    console.error("❌ Exception in createActivity:", ex);
    throw ex;
  }
};

/**
 * Get activity details by call_id
 */
exports.getActivityById = async (call_id) => {
  try {
    return await AICallActivityModel.findOne({ call_id }).populate(
      "organization_id"
    );
  } catch (ex) {
    console.error("❌ Exception in getActivityById:", ex);
    return null;
  }
};
