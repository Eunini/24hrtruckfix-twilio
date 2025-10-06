const mongoose = require("mongoose");
const SystemStatus = require("../models/systemStatus.model"); 
const userModel = require("../models/user.model");

const STATUS_ID = process.env.MONGODB_STATUS_ID;
if (!STATUS_ID) {
    console.warn("Warning: MONGODB_STATUS_ID is not set in env; SystemStatus endpoints will error.");
}

// GET Returns the current system status.
exports.getSystemStatus = async (req, res) => {
    console.log(STATUS_ID)
    try {
        if (!STATUS_ID || !mongoose.Types.ObjectId.isValid(STATUS_ID)) {
        return res.status(500).json({
            success: false,
            message: "SystemStatus ID not configured correctly",
      });
    }

    const statusDoc = await SystemStatus.findById(STATUS_ID).lean();
    if (!statusDoc) {
        return res.status(404).json({
            success: false,
            message: "SystemStatus document not found",
        });
    }

    return res.json({ success: true, data: statusDoc });
} catch (err) {
    console.error("Error in getSystemStatus:", err);
    return res.status(500).json({
        success: false,
        message: "Server error fetching system status",
    });
}
};

// POST Toggles the `active` field on the SystemStatus 
exports.toggleSystemActive = async (req, res) => {
    console.log(STATUS_ID)
    try {
        if (!STATUS_ID || !mongoose.Types.ObjectId.isValid(STATUS_ID)) {
        return res.status(500).json({
            success: false,
            message: "SystemStatus ID not configured correctly",
        });
    }

    const statusDoc = await SystemStatus.findById(STATUS_ID);
    if (!statusDoc) {
        return res.status(404).json({
            success: false,
            message: "SystemStatus document not found",
        });
    }
    const userId = req.user.userId
    console.log(userId)
    const user = await userModel.findById(userId).populate("role_id");
    if (!user) throw new Error("User not found");

    if ( !["super_admin"].includes(user.role_id?.name) ) {
      throw new Error("User Not Allowed ❌");
    }
    
    const updated = await statusDoc.toggleActive();
    return res.json({ success: true, data: updated });
    
} catch (err) {
    console.error("Error in toggleSystemActive:", err);
    return res.status(500).json({
        success: false,
        message: err.message || "Server error toggling system active status",
    });
}
};

// POST toggle liveMode
exports.toggleSystemLiveMode = async (req, res) => {
    console.log(STATUS_ID)
  try {
    if (!STATUS_ID || !mongoose.Types.ObjectId.isValid(STATUS_ID)) {
      return res.status(500).json({
        success: false,
        message: "SystemStatus ID not configured correctly",
      });
    }

    const statusDoc = await SystemStatus.findById(STATUS_ID);
    if (!statusDoc) {
      return res.status(404).json({
        success: false,
        message: "SystemStatus document not found",
      });
    }

    const updated = await statusDoc.toggleLiveMode();
    return res.json({ success: true, data: updated });

  } catch (err) {
    console.error("Error in toggleSystemLiveMode:", err);
    return res.status(500).json({
      success: false,
      message: "Server error toggling system liveMode",
    });
  }
};
