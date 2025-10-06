const { Ticket } = require('../models');
const { HTTP_STATUS_CODES } = require('../helper');

exports.getTotalActivities = async (req, res) => {
  try {
    const totalTickets = await Ticket.countDocuments();
    const statusResults = await Ticket.aggregate([
      {
        $group: {
          _id: null,
          pending: {
            $sum: {
              $cond: [
                { $in: ["$status", ["assigned", "in-progress", "created"]] },
                1,
                0,
              ],
            },
          },
          completed: {
            $sum: {
              $cond: [{ $in: ["$status", ["cancelled", "completed"]] }, 1, 0],
            },
          },
        },
      },
    ]);
    
    res.status(HTTP_STATUS_CODES.OK).json({
      message: "Activities retrieved successfully",
      total: totalTickets,
      activityCount: statusResults,
    });
  } catch (error) {
    console.error("Error retrieving activities:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      message: "Failed to retrieve activities",
      error: error.message,
    });
  }
};
