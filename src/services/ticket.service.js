const { Ticket, User, Organization, Mechanic, Task, Request } = require("../models");
const { HTTP_STATUS_CODES } = require("../helper");
const { sendNewTicketTriggerService } = require("./ai/ticketTrigger");
const { emitProgressService } = require("./ai/notification");
const messageController = require("../controllers/conversation.controller");
const { createTasksForTrigger, handleEtaExpired } = require("./task.service");
const { getDrivingDistanceMiles, geocodeAddress } = require("../utils/geocode.js");
const { Types: { ObjectId } } = require("mongoose");
const { sendGenericEmail, createEmailBody } = require("./mail/signinemail.js");
// Helper function to remove empty string fields from an object
const removeEmptyStringFields = (obj) => {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removeEmptyStringFields(item));
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === "") {
      // Skip empty strings
      continue;
    } else if (typeof value === "object" && value !== null) {
      // Recursively clean nested objects
      const cleanedValue = removeEmptyStringFields(value);
      if (Object.keys(cleanedValue).length > 0 || Array.isArray(cleanedValue)) {
        cleaned[key] = cleanedValue;
      }
    } else {
      // Keep non-empty values
      cleaned[key] = value;
    }
  }
  return cleaned;
};

const validateServices = (services) => {
  if (!Array.isArray(services) || services.length === 0) {
    return "services must be a non-empty array";
  }
  for (const s of services) {
    if (!s || typeof s !== "object") return "each service must be an object";
    if (!s.name || String(s.name).trim() === "") return "each service must have a name";
    if (s.cost === undefined || s.cost === null || isNaN(Number(s.cost)))
      return "each service must have a numeric cost";
  }
  return null;
}

// Allowed fields for location update
const ALLOWED_LOCATION_FIELDS = ["current_address", "coord", "coord_details"];

// Format location input to match serverless implementation
const formatLocationInput = (payload) => {
  const formattedInput = {};
  for (const field of ALLOWED_LOCATION_FIELDS) {
    if (payload[field]?.length) {
      formattedInput[field] = payload[field];
    }
  }
  return formattedInput;
};

// Get all tickets with pagination and filters
exports.getTickets = async (
  page = 1,
  limit = 10,
  search = "",
  sortField = "createdAt",
  sortOrder = -1,
  startDate,
  endDate,
  status,
  userId
) => {
  try {
    // Get user's organization
    const userOrg = await Organization.findOne({
      $or: [{ owner: userId }],
    });

    if (!userOrg) {
      return {
        statusCode: HTTP_STATUS_CODES.NOT_FOUND,
        body: { message: "User organization not found" },
      };
    }

    const query = {
      organization_id: userOrg._id,
    };

    // Add search filter if provided
    if (search) {
      query.$or = [
        { policy_number: { $regex: search, $options: "i" } },
        { insured_name: { $regex: search, $options: "i" } },
        { vehicle_type: { $regex: search, $options: "i" } },
        { current_address: { $regex: search, $options: "i" } },
      ];
    }

    // Add date range filter if provided
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortField]: parseInt(sortOrder) },
      populate: [
        { path: "client_id", select: "firstname lastname email" },
        { path: "assigned_to", select: "firstname lastname email" },
      ],
    };

    const tickets = await Ticket.paginate(query, options);

    return {
      statusCode: HTTP_STATUS_CODES.OK,
      body: tickets,
    };
  } catch (error) {
    throw new Error(`Error fetching tickets: ${error.message}`);
  }
};

// Get single ticket by ID
exports.getTicketById = async (ticketId) => {
  try {
    const ticket = await Ticket.findById(ticketId)
      .populate("client_id", "firstname lastname email organization")
      .populate("assigned_to", "firstname lastname email")
      .populate({
        path: "client_id",
        populate: {
          path: "organization",
          model: Organization,
        },
      });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    return {
      statusCode: HTTP_STATUS_CODES.OK,
      body: { ticket },
    };
  } catch (error) {
    throw new Error(`Error fetching ticket: ${error.message}`);
  }
};

// Create new ticket
exports.createTicket = async (ticketData) => {
  try {
    // Clean up empty string fields from ticket data
    const cleanedTicketData = removeEmptyStringFields(ticketData);

    const newTicket = await Ticket.create(cleanedTicketData);

    const customer = cleanedTicketData?.insured_name;
    const description = cleanedTicketData?.comments;
    const ticketType = cleanedTicketData?.breakdown_reason;
    const location = cleanedTicketData?.breakdown_address;
    const destination = cleanedTicketData?.tow_destination;
    const ticketText = cleanedTicketData?.breakdown_reason_text;
    const aiAssign = newTicket?.assignedByAi;
    const scheduledTime = newTicket?.scheduled_time;
    const claimNumber = newTicket?.claim_number;

    await emitProgressService({
      ticketId: newTicket._id,
      step: "ticketCreated",
      status: "success",
      metadata: {
        customer,
        aiAssign,
        ticketType,
        ticketText,
        description,
        location,
        destination,
        scheduledTime,
        claimNumber,
      },
    });

    const ctx = {
      client_location: `${newTicket.breakdown_address.street}, ${newTicket.breakdown_address.city}, ${newTicket.breakdown_address.state}` || location ,
      aiAttempt: aiAssign,
      initial_search_radius: "40 mile radius",
      search_expansion_increment: "10 miles",
      ticket_id: newTicket?._id,
      organization_id: newTicket?.organization_id
    }

    await createTasksForTrigger("ticket_created", ctx)
    await sendNewTicketTriggerService(newTicket);

    if(newTicket?.assigned_subcontractor) {
      const mechanic = await Mechanic.findById(newTicket?.assigned_subcontractor).lean()
      const cto = {
        sp_name: mechanic?.companyName || mechanic?.businessName || `${mechanic?.firstName} ${mechanic?.lastName}`,
          sp_contact_email: mechanic?.email  || mechanic?.email_2,
          sp_contact_phone: mechanic?.mobileNumber || mechanic?.businessNumber || mechanic?.office_num,
          ticket_id: newTicket?._id,
          organization_id: newTicket?.organization_id
        }
        // Skip if task already created
        const taskAlreadyExists = await Task.exists({ ticket_id: newTicket._id, title: "Dispatch Work Order to SP" });
        console.log(!!taskAlreadyExists)
        if (!taskAlreadyExists) {
          await createTasksForTrigger("sp_assigned", cto)
        }      
    }

    if (!newTicket?.eta) {
      console.log("No ETA on ticket, skipping ETA‑expiry check");
    } else {
      const untilEta = newTicket?.eta?.getTime() - Date.now();
      setTimeout(() => {
        handleEtaExpired(newTicket._id);
      }, untilEta);
    }

    if(newTicket.coord && newTicket.assigned_subcontractor) {
      const destination = newTicket.coord;
      let origin;
      const mech = await Mechanic.findById(newTicket.assigned_subcontractor)
      if (mech.mechanicLocationLatitude && mech.mechanicLocationLongitude) {
        origin = {
          latitude: mech.mechanicLocationLatitude,
          longitude: mech.mechanicLocationLongitude
       }
      } else {
        const parts = [];
        if (mech.streetAddress) {parts.push(mech.streetAddress)}
        else if (mech.address) {parts.push(mech.address);}
        if (mech.city) parts.push(mech.city);
        if (mech.state) parts.push(mech.state);
        if (mech.country) parts.push(mech.country);
        if (mech.zipcode) parts.push(mech.zipcode);
    
        const addressString = parts.join(", ");
        if (addressString) {
    
          const coord = await geocodeAddress(addressString);
          if (coord) {
            mech.mechanicLocation = {
              type: "Point",
              coordinates: [parseFloat(coord.longitude), parseFloat(coord.latitude)]
            };
            
            mech.mechanicLocationLatitude = coord.latitude;
            mech.mechanicLocationLongitude = coord.longitude;

            await mech.save()

            origin = {
              latitude: coord.latitude,
              longitude: coord.longitude
            }
          } else {
            console.warn("Geocoding failed for new mechanic address:", addressString);
            throw new Error("Unable to geocode mechanic address");
          }
        }
      }
      if (!origin || !destination) return;

      const travel = await getDrivingTime(origin, destination);
      const seconds = Number(travel.seconds);
      const nowMs    = Date.now();
      const etaMs    = nowMs + seconds * 1000; 
      const etaDate  = new Date(etaMs);  
      newTicket.estimated_eta = etaDate
    }

    return {
      statusCode: HTTP_STATUS_CODES.CREATED,
      body: { ticket: newTicket },
    };
  } catch (error) {
    console.error("Error creating ticket:", error);
    throw new Error(`Failed to create ticket: ${error.message}`);
  }
};

// Update ticket
exports.updateTicket = async (ticketId, updateData) => {
  try {
    // Clean up empty string fields from update data
    const cleanedUpdateData = removeEmptyStringFields(updateData);

    const ticket = await Ticket.findByIdAndUpdate(
      ticketId,
      { $set: cleanedUpdateData },
      { new: true }
    )
      .populate("client_id", "firstname lastname email")
      .populate("assigned_to", "firstname lastname email");

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if(ticket.coord && ticket.assigned_subcontractor) {
      const destination = ticket.coord;
      let origin;
      const mech = await Mechanic.findById(ticket.assigned_subcontractor)
      if (mech.mechanicLocationLatitude && mech.mechanicLocationLongitude) {
        origin = {
          latitude: mech.mechanicLocationLatitude,
          longitude: mech.mechanicLocationLongitude
       }
      } else {
        const parts = [];
        if (mech.streetAddress) {parts.push(mech.streetAddress)}
        else if (mech.address) {parts.push(mech.address);}
        if (mech.city) parts.push(mech.city);
        if (mech.state) parts.push(mech.state);
        if (mech.country) parts.push(mech.country);
        if (mech.zipcode) parts.push(mech.zipcode);
    
        const addressString = parts.join(", ");
        if (addressString) {
    
          const coord = await geocodeAddress(addressString);
          if (coord) {
            mech.mechanicLocation = {
              type: "Point",
              coordinates: [parseFloat(coord.longitude), parseFloat(coord.latitude)]
            };
            
            mech.mechanicLocationLatitude = coord.latitude;
            mech.mechanicLocationLongitude = coord.longitude;

            await mech.save()

            origin = {
              latitude: coord.latitude,
              longitude: coord.longitude
            }
          } else {
            console.warn("Geocoding failed for new mechanic address:", addressString);
            throw new Error("Unable to geocode mechanic address");
          }
        }
      }
      if (!origin || !destination) return;

      const travel = await getDrivingTime(origin, destination);
      const seconds = Number(travel.seconds);
      const nowMs    = Date.now();
      const etaMs    = nowMs + seconds * 1000; 
      const etaDate  = new Date(etaMs); 
      ticket.estimated_eta = etaDate;
      console.log(ticket?.estimated_eta);
    }
    
    if(ticket?.assigned_subcontractor) {
      const mechanic = await Mechanic.findById(ticket?.assigned_subcontractor).lean()
      const cto = {
        sp_name: mechanic?.companyName || mechanic?.businessName || `${mechanic?.firstName} ${mechanic?.lastName}`,
        sp_contact_email: mechanic?.email  || mechanic?.email_2,
        sp_contact_phone: mechanic?.mobileNumber || mechanic?.businessNumber || mechanic?.office_num,
        ticket_id: ticket?._id,
        organization_id: ticket?.organization_id
      }
      
      // Skip if task already created
      const taskAlreadyExists = await Task.exists({ ticket_id: ticket._id, title: "Dispatch Work Order to SP" });
      console.log({taskAlreadyExists})
      if (!taskAlreadyExists) {
        await createTasksForTrigger("sp_assigned", cto)
      }
    }

    if (ticket?.eta && ticket.status !== "in-progress") {
      const untilEta = ticket?.eta?.getTime() - Date.now();
      setTimeout(() => {
        handleEtaExpired(ticket._id);
      }, untilEta);
    }

    if (ticket.status === "in-progress") {     
      const breakdownReason = updatedTicket.breakdown_reason?.[0]?.label?.toLowerCase() || updatedTicket.breakdown_reason?.[0]?.key?.toLowerCase();
      console.log({breakdownReason})
      let delayMs;
      switch (breakdownReason) {
        case "flat_tire":
        case "battery_replacement":
        case "jump_start":
        case "fuel_delivery":
        case "tire_replacement":
          delayMs = 15 * 60 * 1000; // 15 minutes
        break;
        case "lockout":
          delayMs = 30 * 60 * 1000; // 30 minutes
        break;
        case "towing":
          const defaultMiles = 5; // since mileage doesn't exist
          const minutes = defaultMiles * 4; // 4 minutes per mile
          delayMs = minutes * 60 * 1000;
        break;
        default:
          console.warn(`Unknown breakdown reason: ${breakdownReason}. Skipping confirmation cadence.`);
          return;
      }

      // Schedule the task
      setTimeout(() => {
        handleCadence(ticket._id);
      }, delayMs);
    } 

    return {
      statusCode: HTTP_STATUS_CODES.OK,
      body: {
        message: "Ticket updated successfully",
        ticket,
      },
    };
  } catch (error) {
    throw new Error(`Error updating ticket: ${error.message}`);
  }
};

// Update ticket location
exports.updateTicketLocation = async (ticketId, locationData) => {
  try {
    const formattedLocation = formatLocationInput(locationData);

    if (Object.keys(formattedLocation).length === 0) {
      throw new Error("No valid location fields provided");
    }

    // Clean up empty string fields from location data
    const cleanedLocationData = removeEmptyStringFields(formattedLocation);

    const ticket = await Ticket.findByIdAndUpdate(
      ticketId,
      { $set: cleanedLocationData },
      { new: true }
    )
      .populate("client_id", "firstname lastname email")
      .populate("assigned_to", "firstname lastname email");

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    return {
      statusCode: HTTP_STATUS_CODES.OK,
      body: { ticket },
    };
  } catch (error) {
    throw new Error(`Error updating ticket location: ${error.message}`);
  }
};

// Delete ticket
exports.deleteTicket = async (ticketId) => {
  try {
    const ticket = await Ticket.findByIdAndDelete(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    return {
      statusCode: HTTP_STATUS_CODES.OK,
      body: { message: "Ticket deleted successfully" },
    };
  } catch (error) {
    throw new Error(`Error deleting ticket: ${error.message}`);
  }
};

// Get ticket count by status
exports.getTicketCount = async (clientId = null) => {
  try {
    const query = clientId ? { client_id: clientId } : {};
    const counts = await Ticket.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      total: 0,
      open: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    };

    counts.forEach(({ _id, count }) => {
      result[_id.toLowerCase()] = count;
      result.total += count;
    });

    return {
      statusCode: HTTP_STATUS_CODES.OK,
      body: { stats: result },
    };
  } catch (error) {
    throw new Error(`Error getting ticket count: ${error.message}`);
  }
};

// Get active tickets
exports.getActiveTickets = async (clientId = null, limit = 5) => {
  try {
    const query = {
      status: { $in: ["OPEN", "IN_PROGRESS"] },
    };

    if (clientId) {
      query.client_id = clientId;
    }

    const tickets = await Ticket.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("client_id", "firstname lastname email")
      .populate("assigned_to", "firstname lastname email");

    return {
      statusCode: HTTP_STATUS_CODES.OK,
      body: { tickets },
    };
  } catch (error) {
    throw new Error(`Error getting active tickets: ${error.message}`);
  }
};

// Send repair request
exports.sendRepairRequest = async (ticketId, repairData) => {
  try {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    ticket.status = "dispatched";
    ticket.repairRequests = ticket.repairRequests || [];
    ticket.repairRequests.push(repairData);

    await ticket.save();

    return {
      statusCode: HTTP_STATUS_CODES.OK,
      body: { ticket },
    };
  } catch (error) {
    throw new Error(`Error sending repair request: ${error.message}`);
  }
};

exports.createRequestService = async (data) => {
  if (!data) throw new Error("request data is required");

  const { mechanic_id, eta, services, total_cost, ticket_id } = data;

  if (!mechanic_id) throw new Error("mechanic_id is required");

  if (!eta) throw new Error("eta is required");

  const svcErr = validateServices(services);
  if (svcErr) throw new Error(svcErr);

  // compute total_cost if not provided
  let tc = null;
  if (total_cost !== undefined && total_cost !== null) {
    tc = Number(total_cost);
    if (Number.isNaN(tc)) tc = null;
  }
  if ((tc === null || tc === undefined) && Array.isArray(services)) {
    tc = services.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
  }

  const doc = await Request.create({
    ticket_id,
    mechanic_id,
    services,
    total_cost: tc,
    eta: String(eta),
    status: "wait"
  });

  if (doc && ticket_id) {
    try {
      await Ticket.findByIdAndUpdate(
        ticket_id,
        { $addToSet: { requests: doc._id } },
        { new: true }
      ).exec();
    } catch (err) {
      console.error("Failed to update Ticket.requests with mechanic_id:", err);
    }
  }
  return doc;
}

exports.declineRequestService = async (requestId) => {
  if (!requestId) throw new Error("requestId is required");

  const doc = await Request.findOne({ _id: new ObjectId(requestId)});
  if (!doc) throw new Error("Request not found");

  if (doc.status === "declined") {
    return doc; // already declined
  }

  doc.status = "declined";
  await doc.save();
  return {
    statusCode: HTTP_STATUS_CODES.OK,
    body: { doc },
  };
}

exports.approveRequestService = async (requestId) => {
  if (!requestId) throw new Error("requestId is required");

  try {
    const reqDoc = await Request.findOne({ _id: new ObjectId(requestId)});
    if (!reqDoc) {
      throw new Error("Request not found");
    }

    if (reqDoc.status !== "agreed") {
      reqDoc.status = "agreed";
      await reqDoc.save();
    }

    // decline all others under same ticket_id except those already declined
    await Request.updateMany(
      {
        ticket_id: reqDoc.ticket_id,
        _id: { $ne: reqDoc._id },
        status: { $ne: "declined" },
      },
      { $set: { status: "declined" } },
    );

    if (reqDoc) {
      try {
        function parseEtaToDate(etaVal) {
          if (!etaVal) return null;
          if (etaVal instanceof Date && !isNaN(etaVal.getTime())) return etaVal;
          const maybeDate = new Date(etaVal);
          if (!isNaN(maybeDate.getTime())) return maybeDate;
  
          const s = String(etaVal).toLowerCase();
          let totalMins = 0;
          const dayMatch = s.match(/(\d+)\s*day/);
          if (dayMatch) totalMins += parseInt(dayMatch[1], 10) * 24 * 60;
          const hourMatch = s.match(/(\d+)\s*hour/);
          if (hourMatch) totalMins += parseInt(hourMatch[1], 10) * 60;
          const minMatch = s.match(/(\d+)\s*min/);
          if (minMatch) totalMins += parseInt(minMatch[1], 10);
  
          if (totalMins > 0) return new Date(Date.now() + totalMins * 60000);
  
          return null;
        }
  
        const ticketUpdate = {};
        if (reqDoc.mechanic_id) {
          ticketUpdate.assigned_subcontractor = reqDoc.mechanic_id;
        }
  
        if (Array.isArray(reqDoc.services) && reqDoc.services.length > 0) {
          ticketUpdate.services = reqDoc.services;
        }
  
        const parsedEta = parseEtaToDate(reqDoc.eta);
        if (parsedEta) {
          ticketUpdate.eta = parsedEta;
        }
        ticketUpdate.status = "assigned";
  
        if (Object.keys(ticketUpdate).length > 0) {
          await Ticket.findByIdAndUpdate(reqDoc.ticket_id, { $set: ticketUpdate }, { new: true }).exec();
        }
      } catch (err) {
        throw err;
      }
    }

    const ticket = await Ticket.findById(reqDoc.ticket_id);
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    const organization = await Organization.findById(ticket.organization_id);
    if (!organization) {
      console.error("Organization not found for ticket");
    }

    const sp = await Mechanic.findById(reqDoc.mechanic_id);
    if (!sp) {
      console.error("Mechanic not found");
    }
    const origin = {
      latitude: sp?.mechanicLocationLatitude,
      longitude: sp?.mechanicLocationLongitude
    }
    const destination = {
      latitude: ticket?.coord?.latitude,
      longitude: ticket?.coord?.longitude
    }
    const travel = await getDrivingDistanceMiles(origin, destination);
    const name = sp?.businessName || sp?.companyName || `${sp?.firstName || ""} ${sp?.lastName || ""}`.trim();
    const sp_num =  sp?.mobileNumber || sp?.businessNumber || sp?.office_num;
    const datas = {
      ticket_id: reqDoc.ticket_id || ticket?._id,
      to: sp_num,
      body:`Congrats ${name}, you got the job. Below is a link to lead you to the driver's exact location using google maps, as well as the driver's contact information.

      Please reply Y to confirm your assignment
      We look forward to your speedy arrival.

      Google Maps Direction to Break Down Location:
      https://www.google.com/maps?q=${ticket.coord.latitude},${ticket.coord.longitude}

      Customer Contact Details:
      Name: Aaron  Swan
      Phone Number: +13102992831

      24 Hour Truck Services`
    }
    const mechSms = await messageController.sendMessage(datas);
    if(!mechSms) {
      await sendGenericEmail({
        title: "Congrats, A Job has been assigned to You",
        to: sp?.email || sp?.email_2,
        subject: "Job Assignment Confirmed - Immediate Response Required",
        body:`Congrats ${name}, you got the job. Below is a link to lead you to the driver's exact location using google maps, as well as the driver's contact information.

      Please reply Y to confirm your assignment
      We look forward to your speedy arrival.

      Google Maps Direction to Break Down Location:
      https://www.google.com/maps?q=${ticket.coord.latitude},${ticket.coord.longitude}

      Customer Contact Details:
      Name: Aaron  Swan
      Phone Number: +13102992831

      24 Hour Truck Services`
      })
    }

    const driver = organization?.companyName || organization?.keyBillingContactName;
    const driverData = {
      ticket_id: reqDoc.ticket_id || ticket?._id,
      to: `${ticket?.cell_country_code?.dialCode}${ticket?.current_cell_number}`,
      body: `Hey ${driver}, we've found a mechanic that can help with your vehicle.
      They are ${travel} away from you and should arrive in about ${reqDoc.eta}.

      Below is  their contact details:
      Name: ${name}
      Phone Number: ${sp_num}
      ${(sp?.businessNumber || sp?.office_num) ? `Business Number: ${sp.businessNumber || sp.office_num}` : ""}

      Stay Safe
      24 Hour Truck Rescue`
    }
    const driverSms = await messageController.sendDriverMessage(driverData);
    if(!driverSms) { 
      const email = organization?.keyBillingContactEmail ||  organization?.approverBillingContactEmail || organization?.escalationContactEmail;
      await sendGenericEmail({
        to: email,
        title: "A Service Provider is coming your way",
        subject: "Ticket Dispatch Confirmed",
        body: `Hey ${driver}, we've found a mechanic that can help with your vehicle.
      They are ${travel} away from you and should arrive in about ${reqDoc.eta}.

      Below is  their contact details:
      Name: ${name}
      Phone Number: ${sp_num}
      ${(sp?.businessNumber || sp?.office_num) ? `Business Number: ${sp.businessNumber || sp.office_num}` : ""}

      Stay Safe
      24 Hour Truck Rescue`
      })
    }

    return {
      statusCode: HTTP_STATUS_CODES.OK,
      body: { reqDoc },
    };
  } catch (err) {
    throw err;
  }
}