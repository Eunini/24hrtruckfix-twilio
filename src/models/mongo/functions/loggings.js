const mongoose = require('mongoose');
const LoggingModel = require('../models/loggings');
const { getMongoConnection } = require('../../../loaders/mongo/connect');

exports.getAllActivityLoggings = async (
  page = 1,
  limit = 10,
  search = '',
  sortField = 'createdAt',
  sort = -1,
  clientId
) => {
  try {
    await getMongoConnection();

    const logSearchCriteria = {};
    const ticketSearchCriteria = {};

    // If clientId is provided, include it in the log search criteria
    if (clientId) {
      logSearchCriteria.clientId = clientId;
    }
    const aggregateQuery = [
      {
        $lookup: {
          from: 'tickets',
          let: { ticketId: '$ticketId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$_id', { $toObjectId: '$$ticketId' }],
                },
              },
            },
            {
              $match: ticketSearchCriteria,
            },
          ],
          as: 'ticketDetails',
        },
      },
      { $unwind: { path: '$ticketDetails', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $and: [logSearchCriteria, { ticketDetails: { $ne: [] } }],
        },
      },
      { $sort: { [sortField]: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $addFields: {
          logs: {
            $ifNull: ['$logs', []],
          },
        },
      },
      { $unwind: '$logs' },
      {
        $addFields: {
          sp_called_count: {
            $cond: {
              if: { $eq: ['$logs.event_type', 'SP_CALLED'] },
              then: 1,
              else: 0,
            },
          },
          sp_intrested_count: {
            $cond: {
              if: { $eq: ['$logs.event_type', 'SP_INTRESTED'] },
              then: 1,
              else: 0,
            },
          },
          sp_onboarded_count: {
            $cond: {
              if: { $eq: ['$logs.event_type', 'SP_ONBOARDED'] },
              then: 1,
              else: 0,
            },
          },
          sp_assigned_count: {
            $cond: {
              if: { $eq: ['$logs.event_type', 'SP_ASSIGNED'] },
              then: 1,
              else: 0,
            },
          },
          sp_responded_count: {
            $cond: {
              if: { $eq: ['$logs.event_type', 'SP_RESPONDED'] },
              then: 1,
              else: 0,
            },
          },
        },
      },
      {
        $group: {
          _id: '$_id',
          logs: { $push: '$logs' },
          spCalledCount: { $sum: '$sp_called_count' },
          spIntrestedCount: { $sum: '$sp_intrested_count' },
          spOnboardedCount: { $sum: '$sp_onboarded_count' },
          spAssignedCount: { $sum: '$sp_assigned_count' },
          spRespondedCount: { $sum: '$sp_responded_count' },
          ticketDetails: { $first: '$ticketDetails' },
        },
      },
    ];

    const result = await LoggingModel.aggregate(aggregateQuery);

    const totalLogs = await LoggingModel.countDocuments({
      $or: [logSearchCriteria, { ticketDetails: { $ne: [] } }],
    });

    return {
      docs: result,
      totalDocs: totalLogs,
      totalPages: Math.ceil(totalLogs / limit),
      page,
      limit,
    };
  } catch (err) {
    console.error("Error fetching all logs with ticket details:", err);
    throw err;
  }
};
