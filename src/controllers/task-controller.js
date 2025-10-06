const common = require("../utils/common");
const api = require("../api");
const { authenticate } = require("../middleware/auth");

exports.getTasks = async (req, res) => {
  try {
    const body = req.body;
    const user = req.user; // From auth middleware

    if (!user || !user.team_id || !user.fleet_id || !user.account_type) {
      return res.status(400).json({ error: "User not found or missing required fields" });
    }

    const selectedAccountType = await common.accessTypesByAccount(user.account_type);
    if (!user.account_type) {
      return res.status(403).json({ error: "User does not have access" });
    }

    const data = await api.getAllTasks(body, {
      accountTypes: selectedAccountType,
      team_id: user.team_id,
      fleet_id: user.fleet_id,
    });

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('getTasks error:', error);
    res.status(400).json({
      success: false,
      message: error.message || "Error occurred while fetching data"
    });
  }
};
