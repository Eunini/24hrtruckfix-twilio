const TicketsModel = require("../models/tickets");
const UserSubContractorModel = require("../models/usersSubContractors");
const { getMongoConnection } = require("../../../loaders/mongo/connect");
const { Types } = require("mongoose");
const { sendNewTicketTrigger } = require("../../../services/ai/ticketTrigger");
const { validatePolicy } = require("./policies");
const UserModel = require("../models/users");
const mongoose = require("mongoose");
const OrganizationModel = require("../models/organization");
const { emitProgress } = require("../../../services/ai/notification");

exports.getTickets = async (
  page = 1,
  limit = 10,
  search = "",
  sortField = "createdAt",
  sort = -1,
  startDate,
  endDate,
  status,
  client_id = ""
) => {
  const query = {};

  console.log({ query });

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0); // Start of the day for startDate
    end.setHours(23, 59, 59, 999); // End of the day for endDate

    query.createdAt = {
      $gte: start,
      $lte: end,
    };
  } else if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    query.createdAt = { $gte: start };
  } else if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    query.createdAt = { $lte: end };
  }

  if (status === "active_tickets") {
    query.status = {
      $in: ["assigned", "in-progress", "dispatched", "inprogress"],
    };
  } else if (status === "inactive_tickets") {
    query.status = { $in: ["cancelled", "completed"] };
  } else if (status) {
    query.status = status;
  }

  if (search.trim() !== "") {
    const searchTerms = search
      .split(" ")
      .filter((term) => term.trim().length > 0);

    query.$and = searchTerms.map((term) => ({
      $or: [
        { policy_number: { $regex: term, $options: "i" } },
        { insured_name: { $regex: term, $options: "i" } },
        { status: { $regex: term, $options: "i" } },
        { vehicle_type: { $regex: term, $options: "i" } },
        { vehicle_make: { $regex: term, $options: "i" } },
        { vehicle_model: { $regex: term, $options: "i" } },
        { vehicle_year: { $regex: term, $options: "i" } },
        { vehicle_color: { $regex: term, $options: "i" } },
        { license_plate_no: { $regex: term, $options: "i" } },
        { current_cell_number: { $regex: term, $options: "i" } },
        { auto_assignment_status: { $regex: term, $options: "i" } },
        { policy_expiration_date: { $regex: term, $options: "i" } },
        { policy_address: { $regex: term, $options: "i" } },
        {
          breakdown_reason: {
            $elemMatch: {
              label: { $regex: term, $options: "i" },
            },
          },
        },
      ],
    }));
  }

  if (client_id) {
    query.client_id = client_id;
  }

  const options = {
    page,
    limit,
    sort: { [sortField]: Number(sort) },
  };

  let tickets = null;
  try {
    await getMongoConnection();
    tickets = await TicketsModel.paginate(query, options);
    const totalTicketCount = await TicketsModel.countDocuments();
    return { tickets, totalTicketCount };
  } catch (ex) {
    console.error("exception getTickets", ex);
  }
  return tickets;
};

exports.createNewTicket = async (ticket, userId) => {
  let newTicket = null;
  let ticket_ID = null;
  try {
    await getMongoConnection();
    const trimmedClientId = ticket.client_id.trim();
    if (!mongoose.Types.ObjectId.isValid(trimmedClientId)) {
      throw new Error(
        `Client ID does not exist in the User collection: ${ticket.client_id}`
      );
    }
    const clientId = mongoose.Types.ObjectId(trimmedClientId);
    const clientUser = await UserModel.findOne({ _id: clientId });
    console.log("clientUser:", clientUser);

    if (!clientUser) {
      console.error(
        `Client ID "${ticket.client_id}" does not exist in the User collection.`
      );
      throw new Error("Client ID does not exist in the User collection.");
    }

    //find client's organization and extract id
    const clientOrganization = await OrganizationModel.findOne({
      owner: clientUser._id,
    });

    if (!clientOrganization) {
      throw new Error("Client organization not found.");
    }

    if (!ticket?.policy_expiration_date && ticket?.policy_number) {
      throw new Error("Policy expiration date is missing.");
    }

    const policyExpirationDate = new Date(ticket.policy_expiration_date);
    const currentDate = new Date();

    if (policyExpirationDate < currentDate) {
      throw new Error("The policy is expired. Cannot create the ticket.");
    }

    if (!ticket?.current_cell_number) {
      throw new Error("Current cell number is missing or empty.");
    }

    const newCellNumber = ticket.current_cell_number.replace(/-/g, "").trim();

    ticket.current_cell_number = newCellNumber;

    const policyValidationResult = await validatePolicy(ticket);

    if (!ticket?.status?.length) {
      delete ticket.status;
    }

    if (!ticket?.vehicle_make) {
      throw new Error("Vehicle make is missing or empty.");
    }

    if (!ticket?.vehicle_model) {
      throw new Error("Vehicle model is missing or empty.");
    }

    const subcontractors = ticket.assigned_subcontractor
      ? ticket.assigned_subcontractor
      : null;

    newTicket = await TicketsModel.create({
      ...ticket,
      assigned_subcontractor: subcontractors,
      organization_id: clientOrganization._id,
    });
    const customer = ticket?.insured_name;
    const description = ticket?.comments;
    const ticketType = ticket?.breakdown_reason;
    const location = ticket?.breakdown_address;
    const destination = ticket?.tow_destination;
    const ticketText = ticket?.breakdown_reason_text;
    const aiAssign = newTicket?.assignedByAi;
    ticket_ID  = newTicket?._id;
    await emitProgress({
      ticketId: ticket_ID,
      step:      'ticketCreated',
      status:    'success',
      metadata: {
        customer, 
        aiAssign,
        ticketType,
        ticketText,
        description,
        location,
        destination
      }
    });
    await sendNewTicketTrigger(newTicket);
  } catch (ex) {
    console.error("exception createNewTicket", ex);
    throw ex;
  }

  console.log("*****************************************************");
  console.log(newTicket);
  console.log("*******************************************");

  const userDetails = await UserModel.findOne({ _id: userId });

  const adminUser = userDetails.body;

  if (userDetails.aiswitch) {
    const transformedTicket = {
      ns: {
        db: "24HRClientDev",
        coll: "tickets",
      },
      fullDocument: {
        organization_id: newTicket.organization_id ?? "",
        comments: newTicket.comments ?? "",
        insured_name: newTicket.insured_name ?? "",
        vehicle_make: newTicket.vehicle_make ?? "",
        breakdown_reason: newTicket.breakdown_reason ?? [],
        vehicle_type: newTicket.vehicle_type ?? "",

        current_cell_number: newTicket.current_cell_number ?? "",
        coord_details: newTicket.coord_details ?? [],
        breakdown_address: {
          address_line_1: newTicket.breakdown_address.address_line_1 ?? "",
          city: newTicket.breakdown_address.city ?? "",
          state: newTicket.breakdown_address.state ?? "",
          street: newTicket.breakdown_address.street ?? "",
          zipcode: newTicket.breakdown_address.zipcode ?? "",
          _id: newTicket.breakdown_address._id.toString() ?? "",
        },
        updatedAt: newTicket.updatedAt.toString(),
        vehicle_color: newTicket.vehicle_color ?? "",
        cell_country_code: {
          label: newTicket.cell_country_code?.label || "",
          dialCode: newTicket.cell_country_code?.dialCode || "",
          _id: newTicket.cell_country_code?._id.toString() || "",
          id: newTicket.cell_country_code?.id || "",
        },
        tow_destination: {
          state: newTicket.tow_destination.state ?? "",
          city: newTicket.tow_destination.city ?? "",
          zipcode: newTicket.tow_destination.zipcode ?? "",
          _id: newTicket.tow_destination._id.toString() ?? "",
          street: newTicket.tow_destination.street ?? "",
          address_line_1: newTicket.tow_destination.address_line_1 ?? "",
        },
        vehicle_year: newTicket.vehicle_year ?? "",
        breakdown_reason_text: newTicket.breakdown_reason_text ?? "",
        __v: newTicket.__v ?? "",
        policy_address: newTicket.policy_address ?? "",
        vehicle_model: newTicket.vehicle_model ?? "",
        policy_expiration_date: newTicket.policy_expiration_date ?? "",
        status: newTicket.status ?? "",
        assigned_subcontractor: newTicket.assigned_subcontractor,
        policy_number: newTicket.policy_number ?? "",
        _id: newTicket._id.toString(),
        createdAt: newTicket.createdAt.toString(),
      },
      documentKey: {
        _id: newTicket._id.toString(),
      },
      wallTime: new Date().toISOString(),
      operationType: "insert",
      clusterTime: {
        $timestamp: {
          i: 1,
          t: Math.floor(Date.now() / 1000),
        },
      },
    };

    console.log("*****************************************************");
    console.log("*****************************************************");
    console.log("*****************************************************");
    console.log(transformedTicket);
    console.log("*******************************************");
    await sendNewTicketTrigger(transformedTicket);
  }

  return newTicket;
};

exports.AicreateNewTicket = async (ticket) => {
  console.log("Creating new ticket:", { ticket });
  let newTicket = null;

  try {
    // Validate required fields first
    // if (!ticket?.vehicle_make) throw new Error('Vehicle make is required');
    // if (!ticket?.vehicle_model) throw new Error('Vehicle model is required');
    // if (!ticket?.vehicle_color) throw new Error('Vehicle color is required');
    // if (!ticket?.vehicle_year) throw new Error('Vehicle year is required');
    if (!ticket?.breakdown_reason_text)
      throw new Error("Breakdown reason is required");

    // Database operations
    await getMongoConnection();

    const currentDate = new Date();
    // ticket.current_cell_number = newCellNumber; // Ensure newCellNumber is defined

    // const policyValidationResult = await validatePolicy(ticket);
    // if (!policyValidationResult?.valid) {
    //   throw new Error('Policy validation failed');
    // }

    // Create ticket
    newTicket = await TicketsModel.create({
      ...ticket,
      assignedByAi: true,
      client_id: ticket?.client_id,
      createdAt: currentDate,
      updatedAt: currentDate,
    });

    console.log("Ticket created successfully:", newTicket);

    // Get user details
    // const userDetails = await UserModel.findOne({ _id: userId });
    // if (!userDetails) {
    //   throw new Error('User not found');
    // }

    // AI processing if enabled

    try {
      const transformedTicket = transformTicketForAI(newTicket);
      console.log("Sending to AI system:", transformedTicket);
      console.log("Sending to AI system:", transformedTicket);
      await sendNewTicketTrigger(transformedTicket);
      const aiAssign = newTicket?.assignedByAi;
      const ticketText = ticket?.breakdown_reason_text;
      const ticketType = ticket?.breakdown_reason;
      const customer = ticket?.insured_name;
      const description = ticket?.comments;
      const location = ticket?.breakdown_address;
      const destination = ticket?.tow_destination;
      await emitProgress({
        ticketId: ticket?._id || ticket?.id,
        step:      'ticketCreatedByAi',
        status:    'success',
        metadata: {
          customer, 
          aiAssign,
          ticketType,
          ticketText,
          description,
          location,
          destination
        }
      });
      return {
        message: "Ticket was created successfully",
      };
    } catch (aiError) {
      console.error("AI processing failed (non-critical):", aiError);
      // Continue even if AI processing fails
      return {
        message: "Ticket creation failed",
      };
    }

    return {
      success: true,
      data: newTicket,
      message: "Ticket created successfully",
    };
  } catch (error) {
    console.error("Failed to create ticket:", {
      error: error.message,
      stack: error.stack,
      ticketData: ticket,
    });
    await emitProgress({
      ticketId: ticket?._id || ticket?.id,
      step:      'ticketCreatedByAi',
      status:    'error',
      metadata: {
        error: error.message,
        stack: error.stack,
      }
    });

    // Return error response
    return {
      success: false,
      error: error.message,
      message: "Failed to create ticket",
    };
  }
};

// Helper function for ticket transformation
function transformTicketForAI(ticket) {
  if (!ticket) throw new Error("No ticket provided for transformation");

  return {
    ns: {
      db: "24HRClientDev",
      coll: "tickets",
    },
    fullDocument: {
      client_id: ticket.client_id ?? "",
      comments: ticket.comments ?? "",
      insured_name: ticket.insured_name ?? "",
      vehicle_make: ticket.vehicle_make ?? "",
      breakdown_reason: ticket.breakdown_reason ?? [],
      vehicle_type: ticket.vehicle_type ?? "",
      current_cell_number: ticket.current_cell_number ?? "",
      coord_details: ticket.coord_details ?? [],
      breakdown_address: ticket.breakdown_address
        ? {
            address_line_1: ticket.breakdown_address.address_line_1 ?? "",
            city: ticket.breakdown_address.city ?? "",
            state: ticket.breakdown_address.state ?? "",
            street: ticket.breakdown_address.street ?? "",
            zipcode: ticket.breakdown_address.zipcode ?? "",
            _id: ticket.breakdown_address._id?.toString() ?? "",
          }
        : null,
      updatedAt: ticket.updatedAt?.toString() ?? "",
      vehicle_color: ticket.vehicle_color ?? "",
      cell_country_code: ticket.cell_country_code
        ? {
            label: ticket.cell_country_code.label ?? "",
            dialCode: ticket.cell_country_code.dialCode ?? "",
            _id: ticket.cell_country_code._id?.toString() ?? "",
            id: ticket.cell_country_code.id ?? "",
          }
        : null,
      tow_destination: ticket.tow_destination
        ? {
            state: ticket.tow_destination.state ?? "",
            city: ticket.tow_destination.city ?? "",
            zipcode: ticket.tow_destination.zipcode ?? "",
            _id: ticket.tow_destination._id?.toString() ?? "",
            street: ticket.tow_destination.street ?? "",
            address_line_1: ticket.tow_destination.address_line_1 ?? "",
          }
        : null,
      vehicle_year: ticket.vehicle_year ?? "",
      breakdown_reason_text: ticket.breakdown_reason_text ?? "",
      __v: ticket.__v ?? "",
      policy_address: ticket.policy_address ?? "",
      vehicle_model: ticket.vehicle_model ?? "",
      policy_expiration_date: ticket.policy_expiration_date ?? "",
      status: ticket.status ?? "",
      assigned_subcontractor: ticket.assigned_subcontractor ?? null,
      policy_number: ticket.policy_number ?? "",
      _id: ticket._id?.toString() ?? "",
      createdAt: ticket.createdAt?.toString() ?? "",
    },
    documentKey: {
      _id: ticket._id?.toString() ?? "",
    },
    wallTime: new Date().toISOString(),
    operationType: "insert",
    clusterTime: {
      $timestamp: {
        i: 1,
        t: Math.floor(Date.now() / 1000),
      },
    },
  };
}

exports.getTicketDetailsById = async (ticket_id) => {
  console.log("ticket_id", ticket_id);
  let ticket = null;
  try {
    await getMongoConnection();
    ticket = await TicketsModel.findById(ticket_id);
    return ticket;
  } catch (ex) {
    console.error("exception getTicketDetailsById", ex);
  }
  return ticket;
};

exports.getTicketCount = async () => {
  const today = new Date();
  const last7Days = [];

  // Create an array of dates for the last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    last7Days.push(date.toISOString().split("T")[0]);
  }

  try {
    await getMongoConnection();

    // Fetch ticket counts for the last 7 days
    const results = await TicketsModel.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(today.setDate(today.getDate() - 7)) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          date: "$_id",
          count: 1,
          _id: 0,
        },
      },
      { $sort: { date: 1 } },
    ]);

    // Ensure all dates are represented
    const countsByDate = last7Days.map((date) => {
      const entry = results.find((result) => result.date === date);
      return { date, count: entry ? entry.count : 0 };
    });

    // Fetch ticket status counts
    const statusResults = await TicketsModel.aggregate([
      {
        $group: {
          _id: null,
          active: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    ["assigned", "inprogress", "dispatched", "in-progress"],
                  ],
                },
                1,
                0,
              ],
            },
          },
          inactive: {
            $sum: {
              $cond: [{ $in: ["$status", ["cancelled", "completed"]] }, 1, 0],
            },
          },
        },
      },
    ]);

    const ticketStatusCounts =
      statusResults.length > 0
        ? {
            active: statusResults[0].active,
            inactive: statusResults[0].inactive,
          }
        : {
            active: 0,
            inactive: 0,
          };

    const totalTicketDocs = await TicketsModel.countDocuments();
    return {
      countsByDate,
      ticketStatusCounts,
      totalTicketDocs,
    };
  } catch (error) {
    console.error("Error getting ticket stats:", error);
    throw error;
  }
};

exports.getTicketActive = async () => {
  try {
    await getMongoConnection();
    console.log("wdfretrtey4wtarewrwty,rfirtdstr");
    const result = await TicketsModel.aggregate([
      {
        $group: {
          _id: null,
          active: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$status",
                    ["assigned", "inprogress", "dispatched", "in-progress"],
                  ],
                },
                1,
                0,
              ],
            },
          },
          inactive: {
            $sum: {
              $cond: [{ $in: ["$status", ["cancelled", "completed"]] }, 1, 0],
            },
          },
        },
      },
    ]);

    console.log(result, "resul");

    if (result.length > 0) {
      return {
        active: result[0].active,
        inactive: result[0].inactive,
      };
    } else {
      return {
        active: 0,
        inactive: 0,
      };
    }
  } catch (error) {
    console.error("Error fetching ticket status counts:", error);
    throw error;
  }
};

const ticketAssigned = ["assigned"];
const ticketRecieved = [
  "recieved",
  "in-progress",
  "cancelled",
  "completed",
  "archived",
];
const ticketInProgress = ["in-progress", "cancelled", "completed", "archived"];
const ticketCancelled = ["cancelled", "archived"];
const ticketCompleted = ["completed", "archived"];
exports.updateTicket = async (ticket, ticket_id) => {
  console.log("updateTicket input", ticket);
  let updateTicket = null;
  try {
    await getMongoConnection();

    // Proceed with the update if no error
    updateTicket = await TicketsModel.findByIdAndUpdate(
      { _id: ticket_id },
      ticket,
      { new: true } // Return the updated document
    );

    console.log("updateTicket", updateTicket);
  } catch (ex) {
    console.error("exception updateTicket", ex);
    throw ex; // Rethrow the error to handle it in the calling function
  }
  return updateTicket;
};

exports.getSubcontractorTickets = async (page = 0, limit = 10, cognito_sub) => {
  console.log("getSubcontractorTickets input", { page, limit, cognito_sub });

  let tickets = null;
  try {
    await getMongoConnection();
    const subcontractor = await UserSubContractorModel.findOne({
      sub: cognito_sub,
    }).select("_id");
    console.log("subcontarctor matched", subcontractor);
    if (!subcontractor?._id) throw "subcontractor not authorized";
    const subcontractor_obj = new Types.ObjectId(subcontractor._id);
    const query = {
      assigned_subcontractor: subcontractor_obj,
      status: { $not: /created/ },
    };
    const options = {
      select: ["-policy_number", "-policy_expiration_date", "-policy_address"],
      page,
      limit,
      sort: { createdAt: -1 },
    };
    tickets = await TicketsModel.paginate(query, options);
    console.log("tickets", tickets);
    return tickets;
  } catch (ex) {
    console.error("exception getTickets", ex);
  }
  return tickets;
};

exports.deleteTicket = async (ticket_id) => {
  try {
    // Ensure that the ticket ID is valid
    if (!mongoose.Types.ObjectId.isValid(ticket_id)) {
      throw new Error(`Invalid ticket ID: ${ticket_id}`);
    }

    // Connect to MongoDB
    await getMongoConnection();

    // Check if the ticket exists
    const ticket = await TicketsModel.findById(ticket_id);
    if (!ticket) {
      throw new Error(`Ticket with ID ${ticket_id} not found.`);
    }

    // Perform the deletion
    const deletedTicket = await TicketsModel.findByIdAndDelete(ticket_id);

    // If the ticket was deleted successfully, return it
    if (deletedTicket) {
      console.log(`Ticket with ID ${ticket_id} deleted successfully.`);
      return deletedTicket;
    } else {
      throw new Error(`Failed to delete ticket with ID ${ticket_id}`);
    }
  } catch (error) {
    console.error("Exception in deleteTicket:", error);
    throw error;
  }
};
