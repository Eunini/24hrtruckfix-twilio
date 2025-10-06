const mongoose = require("mongoose");
const Ticket = require("../models/ticket.model");
const User = require("../models/user.model");
const Organization = require("../models/organization.model");
const Photo = require("../models/photo.model");
const ticketService = require("../services/ticket.service");
const { HTTP_STATUS_CODES } = require("../helper");
const { sendNewTicketTriggerService } = require("../services/ai/ticketTrigger");
const { emitProgressService } = require("../services/ai/notification");
const { Terms, Role, Mechanic, Task } = require("../models");
const { getMechanicPermissions } = require("../utils/orgHelpers");
const { geocodeAddress, getDrivingTime } = require("../utils/geocode.js");
const { isValidObjectId } = require("mongoose");
const {
  createTasksForTrigger,
  handleEtaExpired,
  handleCadence,
} = require("../services/task.service");
const { sendSpecialTicketEmail } = require("../services/mail/ticketmail");
const DEFAULT_TERMS =
  "By Submitting this ticket you acknowledge and approve that we can go find urgent assistance unrestrained by the regular confines of our contract";

// OpenAI integration for breakdown reason categorization
const categorizeBreakdownReason = async (breakdownDescription) => {
  try {
    const { OpenAI } = require("openai");

    if (!process.env.OPENAI_API_KEY) {
      console.log(
        "⚠️ OpenAI API key not found, using default breakdown reason"
      );
      return [{ label: "Other", key: "other", idx: 8 }];
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const systemPrompt = `Given a description of a vehicle issue, return an array of objects containing the "label", "key", and "idx" of the most appropriate service(s) based on the problem. If multiple services are relevant, return all applicable services in an array.

The available services are:

Flat Tire: { "label": "Flat Tire", "key": "flat_tire", "idx": 1 }
Battery Replacement: { "label": "Battery Replacement", "key": "battery_replacement", "idx": 2 }
Jump Start: { "label": "Jump Start", "key": "jump_start", "idx": 3 }
Lockout: { "label": "Lockout", "key": "lockout", "idx": 4 }
Tire Replacement: { "label": "Tire Replacement", "key": "tire_replacement", "idx": 5 }
Fuel Delivery: { "label": "Fuel Delivery", "key": "fuel_delivery", "idx": 6 }
Towing: { "label": "Towing", "key": "towing", "idx": 7 }
Other: { "label": "Other", "key": "other", "idx": 8 }

Example Process:

If the description mentions a flat tire issue, return [ { "label": "Flat Tire", "key": "flat_tire", "idx": 1 } ].
If the description mentions needing a jump start, return [ { "label": "Jump Start", "key": "jump_start", "idx": 3 } ].
If the description does not fit any of the above services, return [ { "label": "Other", "key": "other", "idx": 8 } ].
If more than one service is required, return all relevant services in the array.

Very important note it must start and end with this []
Note If there is no suitable response Return: [ { "label": "Other", "key": "other", "idx": 8 } ] as the default

Return only the JSON array, no additional text.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: breakdownDescription,
        },
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const result = response.choices[0].message.content.trim();
    console.log("🤖 OpenAI breakdown categorization result:", result);

    // Parse the JSON response
    const parsedResult = JSON.parse(result);

    // Validate the response structure
    if (Array.isArray(parsedResult) && parsedResult.length > 0) {
      return parsedResult;
    } else {
      console.log("⚠️ Invalid OpenAI response structure, using default");
      return [{ label: "Other", key: "other", idx: 8 }];
    }
  } catch (error) {
    console.error(
      "❌ Error categorizing breakdown reason with OpenAI:",
      error.message
    );
    // Return default breakdown reason if OpenAI fails

    return [{ label: "Other", key: "other", idx: 8 }];
  }
};

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

// Get tickets with pagination and filters
exports.getTickets = async (req, res) => {
  try {
    const {
      page,
      limit = 10,
      search = "",
      sortField = "createdAt",
      sort = -1,
      startDate,
      endDate,
      status,
    } = req.query;

    const userId = req.user.userId;
    const role = req.user.adminRole;
    const admins = role === "admin" || role === "super_admin";
    let query;

    if (admins) {
      query = {};
    } else {
      // Get user's organization
      const userOrg = await Organization.findOne({
        $or: [{ owner: userId }, { "members.user": userId }],
      });
      if (!userOrg) {
        return res.status(404).json({ message: "User organization not found" });
      }
      query = {
        organization_id: userOrg._id,
      };
    }

    // Add search filter if provided
    if (search) {
      // Common ticket field filters
      const ticketFilters = [
        { policy_number: { $regex: search, $options: "i" } },
        { insured_name: { $regex: search, $options: "i" } },
        { vehicle_type: { $regex: search, $options: "i" } },
        { vehicle_model: { $regex: search, $options: "i" } },
        { vehicle_year: { $regex: search, $options: "i" } },
        { vehicle_color: { $regex: search, $options: "i" } },
        { vehicle_make: { $regex: search, $options: "i" } },
        { current_address: { $regex: search, $options: "i" } },
        { breakdown_reason_text: { $regex: search, $options: "i" } },
        { "breakdown_reason.label": { $regex: search, $options: "i" } },
        { "breakdown_reason.key": { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];

      if (role === "super_admin" || role === "admin") {
        // Include organization name search for sys admins
        const orgs = await Organization.find({
          companyName: { $regex: search, $options: "i" },
        }).select("_id");
        const orgIds = orgs.map((o) => o._id);
        ticketFilters.push({ organization_id: { $in: orgIds } });
      }

      // Combine filters
      query.$or = ticketFilters;
    }

    // Add date range filter if provided
    if (startDate && endDate) {
      query.$and = query.$and || [];
      query.$and.push({
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      });
    }

    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortField]: parseInt(sort) },
      populate: [
        { path: "client_id", select: "firstname lastname email" },
        { path: "photos", select: "image imageContentType uploadedAt" },
        {
          path: "requests",
          select: "mechanic_id total_cost eta status services _id",
        },
      ],
    };

    const tickets = await Ticket.paginate(query, options);
    const totalTicketCount = await Ticket.countDocuments(
      role === "super_admin" || role === "admin"
        ? {} // all tickets
        : { organization_id: query.organization_id }
    );

    res.json({ tickets, totalTicketCount });
  } catch (error) {
    console.error("Error in getTickets:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get tickets across all organizations an agent is connected to.
exports.getCombinedTickets = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      sortField = "createdAt",
      sort = -1,
      startDate,
      endDate,
      status,
    } = req.query;

    const pageNum = parseInt(page, 10) > 0 ? parseInt(page, 10) : 1;
    const limitNum = parseInt(limit, 10) > 0 ? parseInt(limit, 10) : 10;
    const sortDir = parseInt(sort, 10) === 1 ? 1 : -1;
    const userId = req.user?.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      console.warn(
        "getCombinedTickets: invalid or missing req.user.userId:",
        userId
      );
      return res.status(400).json({ message: "Invalid user ID" });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const orgQueryClauses = [
      { assignedAgents: userObjectId },
      { assignedAgent: userObjectId },
      { agentId: userObjectId },
      { "members.user": userObjectId },
    ];

    console.log("getCombinedTickets invoked; agent userId =", userId);
    console.log("Organization lookup clauses:", orgQueryClauses);

    const orgDocs = await Organization.find({ $or: orgQueryClauses })
      .select("_id")
      .lean();
    console.log("Matched organizations for agent:", orgDocs);

    const orgIds = orgDocs
      .map((doc) => doc._id)
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (orgIds.length === 0) {
      console.log(
        "Agent user is not linked to any organizations. Returning empty result."
      );
      const emptyResult = {
        docs: [],
        totalDocs: 0,
        limit: limitNum,
        page: pageNum,
        totalPages: 0,
        pagingCounter: 1,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
      };
      return res.json({ tickets: emptyResult, totalTicketCount: 0 });
    }

    const ticketQuery = {
      organization_id: { $in: orgIds },
    };

    if (typeof search === "string" && search.trim() !== "") {
      const regex = new RegExp(search.trim(), "i");
      ticketQuery.$or = [
        { policy_number: { $regex: regex } },
        { insured_name: { $regex: regex } },
        { vehicle_type: { $regex: regex } },
        { current_address: { $regex: regex } },
      ];
    }

    if (
      typeof startDate === "string" &&
      typeof endDate === "string" &&
      startDate.trim() !== "" &&
      endDate.trim() !== ""
    ) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        ticketQuery.createdAt = { $gte: start, $lte: end };
      } else {
        console.warn(
          "Invalid startDate or endDate, skipping date filter:",
          startDate,
          endDate
        );
      }
    }

    if (typeof status === "string" && status.trim() !== "") {
      ticketQuery.status = status.trim();
    }

    console.log("Final ticketQuery:", ticketQuery);

    const options = {
      page: pageNum,
      limit: limitNum,
      sort: { [sortField]: sortDir },
      populate: [
        { path: "client_id", select: "firstname lastname email" },
        { path: "photos", select: "image imageContentType uploadedAt" },
        {
          path: "requests",
          select: "mechanic_id total_cost eta status services",
        },
      ],
    };
    console.log("Pagination options:", options);

    const tickets = await Ticket.paginate(ticketQuery, options);
    const totalTicketCount = await Ticket.countDocuments(ticketQuery);
    console.log(
      `Returning ${tickets.docs.length} tickets out of ${totalTicketCount}`
    );

    return res.json({ tickets, totalTicketCount });
  } catch (error) {
    console.error("Error in getCombinedTickets:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// Create new ticket
exports.createNewTicket = async (req, res) => {
  let ticket_ID = null;
  try {
    const rawPhotos = Array.isArray(req.body.photos) ? req.body.photos : [];
    const photoDocs = await Promise.all(
      rawPhotos.map(({ image, imageContentType }) => {
        const buffer = Buffer.from(image, "base64");
        return Photo.create({ image: buffer, imageContentType });
      })
    );
    const photoIds = photoDocs.map((p) => p._id);
    const { services = [], photos, is_demo, ...ticket } = req.body;
    const userId = req.user.userId;
    const userRole = req.user.adminRole;
    const member = req.user.organizationRole;
    const memberOrg = req.user.organizationId;
    let clientOrganization;
    // Validate client ID
    const trimmedClientId = userId;
    if (!mongoose.Types.ObjectId.isValid(trimmedClientId)) {
      return res.status(400).json({ message: "Invalid client ID format" });
    }

    // Check if client exists
    const clientUser = await User.findById(trimmedClientId);
    if (!clientUser) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Find client's organization
    clientOrganization = await Organization.findOne({
      owner: clientUser._id,
    });
    if (!clientOrganization || member === "member") {
      clientOrganization = await Organization.findOne({
        _id: memberOrg,
      });
    }

    if (!clientOrganization) {
      return res.status(404).json({ message: "Client organization not found" });
    }

    // Validate policy expiration
    if (ticket.policy_number && !ticket.policy_expiration_date) {
      return res
        .status(400)
        .json({ message: "Policy expiration date is required" });
    }

    if (ticket.policy_expiration_date) {
      const policyExpirationDate = new Date(ticket.policy_expiration_date);
      const currentDate = new Date();
      if (policyExpirationDate < currentDate) {
        return res.status(400).json({
          message: "The policy is expired. Cannot create the ticket.",
        });
      }
    }

    // Validate cell number
    if (!ticket.current_cell_number) {
      return res
        .status(400)
        .json({ message: "Current cell number is required" });
    }

    // Format cell number
    ticket.current_cell_number = ticket.current_cell_number
      .replace(/-/g, "")
      .trim();

    // Validate vehicle details
    if (!ticket.vehicle_make) {
      return res.status(400).json({ message: "Vehicle make is required" });
    }

    if (!ticket.vehicle_model) {
      return res.status(400).json({ message: "Vehicle model is required" });
    }

    if (ticket.assigned_subcontractor) {
      const sub = ticket.assigned_subcontractor.trim();
      if (isValidObjectId(sub)) {
        ticket.assigned_subcontractor = sub;
      } else {
        const nameParts = sub.split(/\s+/);
        let user;

        if (nameParts.length === 1) {
          user = await Mechanic.findOne({
            $or: [{ firstName: nameParts[0] }, { lastName: nameParts[0] }],
          }).select("_id");
          console.log(user);
        } else {
          const lastName = nameParts.pop();
          const firstName = nameParts.join(" ");
          user = await Mechanic.findOne({
            firstName,
            lastName,
          }).select("_id");
        }
        if (!user) {
          return res.status(400).json({
            success: false,
            message: `No user found matching "${sub}" for assigned_subcontractor`,
          });
        }
        ticket.assigned_subcontractor = user._id;
      }
    }

    if (ticket.coord && ticket.assigned_subcontractor) {
      const destination = ticket.coord;
      let origin;
      const mech = await Mechanic.findById(ticket.assigned_subcontractor);
      if (mech.mechanicLocationLatitude && mech.mechanicLocationLongitude) {
        origin = {
          latitude: mech.mechanicLocationLatitude,
          longitude: mech.mechanicLocationLongitude,
        };
      } else {
        const parts = [];
        if (mech.streetAddress) {
          parts.push(mech.streetAddress);
        } else if (mech.address) {
          parts.push(mech.address);
        }
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
              coordinates: [
                parseFloat(coord.longitude),
                parseFloat(coord.latitude),
              ],
            };

            mech.mechanicLocationLatitude = coord.latitude;
            mech.mechanicLocationLongitude = coord.longitude;

            await mech.save();

            origin = {
              latitude: coord.latitude,
              longitude: coord.longitude,
            };
          } else {
            console.warn(
              "Geocoding failed for new mechanic address:",
              addressString
            );
            throw new Error("Unable to geocode mechanic address");
          }
        }
      }
      if (!origin || !destination) return;

      const travel = await getDrivingTime(origin, destination);
      const seconds = Number(travel.seconds);
      const nowMs = Date.now();
      const etaMs = nowMs + seconds * 1000;
      const etaDate = new Date(etaMs);
      ticket.estimated_eta = etaDate;
    }

    if (Array.isArray(ticket.comments)) {
      ticket.comments = ticket.comments
        .filter((c) => typeof c.text === "string")
        .map((c) => ({ ...c, text: c.text.trim() }))
        .filter((c) => c.text.length > 0);
    }

    // Create the ticket
    const newTicket = await Ticket.create({
      ...ticket,
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        cost: s.cost,
      })),
      photos: photoIds,
      estimated_eta: ticket.estimated_eta,
      organization_id: clientOrganization._id,
      status: ticket.status || "created",
      client_id: trimmedClientId,
    });

    if (ticket.assignedByAi) {
      // Send immediate response to avoid blocking
      res.status(201).json({
        message: "Ticket created successfully, AI assignment in progress",
        ticketId: newTicket._id,
      });

      // Continue with AI assignment process asynchronously
      try {
        await sendNewTicketTriggerService(newTicket, true);
      } catch (error) {
        console.error("Error in AI ticket assignment:", error);
        // Log error but don't affect response since it's already sent
      }
      return; // Exit to prevent double response
    }

    if (userRole === "client") {
      await sendSpecialTicketEmail(
        clientUser?.email,
        clientUser?.firstname,
        newTicket?.policy_number
      );
    }

    if (ticket.assigned_subcontractor) {
      const mechanic = await Mechanic.findById(
        ticket.assigned_subcontractor
      ).lean();
      const cto = {
        sp_name:
          mechanic?.companyName ||
          mechanic?.businessName ||
          `${mechanic?.firstName} ${mechanic?.lastName}`,
        sp_contact_phone:
          mechanic?.mobileNumber ||
          mechanic?.businessNumber ||
          mechanic?.office_num,
        sp_contact_email: mechanic?.email || mechanic?.email_2,
        ticket_id: newTicket?._id,
        organization_id: newTicket?.organization_id,
      };

      newTicket.assigned_subcontractor = ticket.assigned_subcontractor;
      newTicket.status = "assigned";
      // Skip if task already created
      const taskAlreadyExists = await Task.exists({
        ticket_id: newTicket._id,
        title: "Dispatch Work Order to SP",
      });
      console.log({ taskAlreadyExists });
      if (!taskAlreadyExists) {
        await createTasksForTrigger("sp_assigned", cto);
      }
    } else {
      newTicket.assigned_subcontractor = null;
    }

    const customer = ticket?.insured_name;
    const description = ticket?.comments;
    const ticketType = ticket?.breakdown_reason[0]?.label;
    const location = ticket?.breakdown_address;
    const destination = ticket?.tow_destination;
    const ticketText = ticket?.breakdown_reason_text;
    const aiAssign = newTicket?.assignedByAi;
    const scheduledTime = newTicket?.scheduled_time;
    const claimNumber = newTicket?.claim_number;
    ticket_ID = newTicket?._id;

    console.log(newTicket, "newTicket");
    const ctx = {
      client_location:
        `${newTicket.breakdown_address.street}, ${newTicket.breakdown_address.city}, ${newTicket.breakdown_address.state}` ||
        location,
      aiAttempt: aiAssign,
      initial_search_radius: "40 mile radius",
      search_expansion_increment: "10 miles",
      ticket_id: ticket_ID,
      organization_id: newTicket?.organization_id || ticket?.organization_id,
    };
    await createTasksForTrigger("ticket_created", ctx);

    if (!newTicket?.eta) {
      console.log("No ETA on ticket, skipping ETA‑expiry check");
    } else {
      const untilEta = newTicket?.eta?.getTime() - Date.now();
      setTimeout(() => {
        handleEtaExpired(newTicket._id);
      }, untilEta);
    }
    await emitProgressService({
      ticketId: ticket_ID,
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

    if (!is_demo) {
      await sendNewTicketTriggerService(newTicket, false);
    }
    res.status(201).json(newTicket);
  } catch (error) {
    console.error("Error in createNewTicket:", error);
    if (ticket_ID) {
      await emitProgressService({
        ticketId: ticket_ID,
        step: "ticketCreated",
        status: "error",
        metadata: {
          error: error.message,
        },
      });
    }
    res.status(400).json({ message: error.message });
  }
};

// Get ticket by ID
exports.getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const admin = req.user.adminRole;
    const admins = admin === "admin" || admin === "super_admin";

    if(admins) {
      const ticket = await Ticket.findById(id);
      return res.status(200).json(ticket);
    }

    // Get user's organization
    const userOrg = await Organization.findOne({
      $or: [{ owner: userId }, { "members.user": userId }],
    });

    if (!userOrg) {
      return res.status(404).json({ message: "User organization not found" });
    }

    const ticket = await Ticket.findOne({
      _id: id,
      organization_id: userOrg._id,
    }).populate("client_id", "firstname lastname email phone");

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json(ticket);
  } catch (error) {
    console.error("Error in getTicketById:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update ticket
exports.updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { photos: incomingPhotos, ...updates } = req.body;
    const photoIds = [];
    const userId = req.user.userId;
    const admin = req.user.adminRole;
    const admins = admin === "admin" || admin === "super_admin";
    // Get user's organization
    let userOrg = await Organization.findOne({
      $or: [
        { owner: userId },
        {
          "members.user": userId,
          // "members.status": "approved"
        },
      ],
    });

    if (!userOrg && !admins) {
      return res.status(404).json({ message: "User organization not found" });
    }

    // Check if ticket exists and belongs to user's organization
    const ticket = await Ticket.findOne({
      _id: id,
    });

    if (!ticket) {
      return res
        .status(404)
        .json({ message: "Ticket not found or unauthorized" });
    }

    let orgIdStr;
    const updateData = {};
    if (admins) {
      orgIdStr = null || "";
    } else {
      orgIdStr = userOrg?._id.toString();
    }
    
    const protectedFields = [
      "_id",
      "id",
      "organization_id",
      "client_id",
      "createdAt",
      "updatedAt",
    ];

    for (const key of Object.keys(updates)) {
      if (protectedFields.includes(key)) {
        continue;
      }
      updateData[key] = updates[key];
    }

    for (const photoData of incomingPhotos || []) {
      const newPhoto = await Photo.create({
        image: Buffer.from(photoData.image.data),
        imageContentType: photoData.imageContentType,
        uploadedAt: photoData.uploadedAt || new Date(),
      });

      photoIds.push(newPhoto._id);
      updateData.photos = photoIds;
    }

    //  Handle assigned_subcontractor (mechanic assignment)
    if (updates.assigned_subcontractor !== undefined) {
      const spId = updates.assigned_subcontractor;
      if (spId) {
        // Assign to a mechanic
        if (
          !spId ||
          typeof spId !== "string" ||
          spId.trim() === "" ||
          !mongoose.Types.ObjectId.isValid(spId)
        ) {
          return;
          // res.status(400).json({ message: "Invalid mechanic ID" });
        }
        // Check if mechanic exists
        const mechanic = await Mechanic.findById(spId);
        if (!mechanic) {
          return res.status(404).json({ message: "Mechanic (SP) not found" });
        }

        if (admins) {
          if (
            Array.isArray(mechanic.blacklisted) &&
            mechanic.blacklisted.length > 0
          ) {
            console.log(`❌ Mechanic is blacklisted.`);
            return res
              .status(403)
              .json({ message: "Cannot assign Blacklisted SP to ticket ❌" });
          }
        } else {
          if (
            Array.isArray(mechanic.blacklisted) &&
            mechanic.blacklisted.map((b) => b.toString()).includes(orgIdStr)
          ) {
            console.log(`❌ Mechanic is blacklisted by org.`);
            return res
              .status(403)
              .json({ message: "Cannot assign Blacklisted SP to ticket ❌" });
          }
        }
        // Check org permissions
        let perms;

        try {
          if (admins) {
            perms = null || "";
          } else {
            perms = await getMechanicPermissions(userOrg._id);
          }
        } catch (err) {
          return res
            .status(500)
            .json({ message: "Failed to read organization settings" });
        }
        const { primaryMechanic, secondaryMechanic, allMechanics } = perms;
        if (primaryMechanic) {
          // only allow assignment if mechanic.organization_id === userOrg._id
          if (
            !mechanic.organization_id ||
            mechanic.organization_id.toString() !== userOrg._id.toString()
          ) {
            return res.status(403).json({
              message:
                "Cannot assign a mechanic outside your organization (primaryMechanic only)",
            });
          }
        } else if (secondaryMechanic || allMechanics || admins) {
          // allowed to assign any mechanic in DB
        } else {
          return res.status(403).json({
            message:
              "Mechanic assignment not permitted by organization settings",
          });
        }

        updateData.assigned_subcontractor = new mongoose.Types.ObjectId(spId);
        updateData.status = "assigned";
      } else {
        updateData.assigned_subcontractor = null;
        updateData.status = "created";
      }
    }

    if (updates.coord && updates.assigned_subcontractor) {
      const destination = updates.coord;
      let origin;
      const mech = await Mechanic.findById(updates.assigned_subcontractor);
      if (mech.mechanicLocationLatitude && mech.mechanicLocationLongitude) {
        origin = {
          latitude: mech.mechanicLocationLatitude,
          longitude: mech.mechanicLocationLongitude,
        };
      } else {
        const parts = [];
        if (mech.streetAddress) {
          parts.push(mech.streetAddress);
        } else if (mech.address) {
          parts.push(mech.address);
        }
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
              coordinates: [
                parseFloat(coord.longitude),
                parseFloat(coord.latitude),
              ],
            };

            mech.mechanicLocationLatitude = coord.latitude;
            mech.mechanicLocationLongitude = coord.longitude;

            await mech.save();

            origin = {
              latitude: coord.latitude,
              longitude: coord.longitude,
            };
          } else {
            console.warn(
              "Geocoding failed for new mechanic address:",
              addressString
            );
            throw new Error("Unable to geocode mechanic address");
          }
        }
      }
      if (!origin || !destination) return;

      const travel = await getDrivingTime(origin, destination);
      const seconds = Number(travel.seconds);
      const nowMs = Date.now();
      const etaMs = nowMs + seconds * 1000;
      const etaDate = new Date(etaMs);
      updateData.estimated_eta = etaDate;
      console.log(updateData?.estimated_eta);
    }

    // 4b. Handle status update
    if (updates.status !== undefined) {
      const allowedStatuses = [
        "created",
        "recieved",
        "assigned",
        "dispatched",
        "in-progress",
        "cancelled",
        "completed",
        "archived",
      ];
      if (!allowedStatuses.includes(updates.status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }
      updateData.status = updates.status;
    }

    if (updates.coord) {
      updateData.coord = updates.coord;
    }

    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ message: "No valid fields provided for update" });
    }

    if (updates.breakdown_address) {
      const parts = [];
      if (updates.breakdown_address.address_line_1)
        parts.push(updates.breakdown_address.address_line_1);
      if (updates.breakdown_address.street)
        parts.push(updates.breakdown_address.street);
      if (updates.breakdown_address.city)
        parts.push(updates.breakdown_address.city);
      if (updates.breakdown_address.state)
        parts.push(updates.breakdown_address.state);
      if (updates.breakdown_address.zipcode)
        parts.push(updates.breakdown_address.zipcode);
      const addressString = parts.join(", ");
      if (addressString) {
        const coord = await geocodeAddress(addressString);
        if (coord) {
          updates.coord = {
            latitude: coord.latitude,
            longitude: coord.longitude,
          };
        } else {
          console.warn(
            "Failed to geocode updated breakdown address:",
            addressString
          );
        }
      }
      updateData.breakdown_address = updates.breakdown_address;
    }

    if (typeof updates.comments === "string" && updates.comments.trim()) {
      updateData["comments"] = {
        text: updates.comments.trim(),
        updatedAt: new Date(),
        user: userId,
      };
    } else if (Array.isArray(updates.comments)) {
      updateData.comments = updates.comments
        .filter((c) => typeof c.text === "string")
        .map((c) => ({
          text: c.text.trim(),
          user: userId,
          updatedAt: new Date(),
        }))
        .filter((c) => c.text.length > 0);
    }

    const updatedTicket = await Ticket.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    ).populate("photos requests");

    if (updatedTicket.assigned_subcontractor) {
      const mechanic = await Mechanic.findById(
        updatedTicket?.assigned_subcontractor
      ).lean();
      const cto = {
        sp_name:
          mechanic?.companyName ||
          mechanic?.businessName ||
          `${mechanic?.firstName} ${mechanic?.lastName}`,
        sp_contact_email: mechanic?.email || mechanic?.email_2,
        sp_contact_phone:
          mechanic?.mobileNumber ||
          mechanic?.businessNumber ||
          mechanic?.office_num,
        ticket_id: updatedTicket?._id,
        organization_id: updatedTicket?.organization_id,
      };

      // Skip if task already created
      const taskAlreadyExists = await Task.exists({
        ticket_id: updatedTicket._id,
        title: "Dispatch Work Order to SP",
      });
      console.log({ taskAlreadyExists });
      if (!taskAlreadyExists) {
        await createTasksForTrigger("sp_assigned", cto);
      }
    }

    if (updatedTicket?.eta && updatedTicket.status !== "in-progress") {
      const untilEta = updatedTicket?.eta?.getTime() - Date.now();
      setTimeout(() => {
        handleEtaExpired(updatedTicket._id);
      }, untilEta);
    }

    if (updatedTicket.status === "in-progress") {
      const breakdownReason =
        updatedTicket.breakdown_reason?.[0]?.label?.toLowerCase() ||
        updatedTicket.breakdown_reason?.[0]?.key?.toLowerCase();
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
          console.warn(
            `Unknown breakdown reason: ${breakdownReason}. Skipping confirmation cadence.`
          );
      }

      // Schedule the task
      setTimeout(() => {
        handleCadence(updatedTicket._id);
      }, delayMs);
    }

    res.json(updatedTicket);
  } catch (error) {
    console.error("Error in updateTicket:", error);
    res.status(400).json({ message: error.message });
  }
};

// Delete ticket
exports.deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ticket ID" });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    await Ticket.findByIdAndDelete(id);
    res.json({ message: "Ticket deleted successfully" });
  } catch (error) {
    console.error("Error in deleteTicket:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get ticket statistics
exports.getTicketStats = async (req, res) => {
  try {
    const today = new Date();
    const last7Days = [];

    // Create array of last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      last7Days.push(date.toISOString().split("T")[0]);
    }

    // Get daily counts
    const results = await Ticket.aggregate([
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

    // Format counts by date
    const countsByDate = last7Days.map((date) => {
      const entry = results.find((result) => result.date === date);
      return { date, count: entry ? entry.count : 0 };
    });

    // Get status counts
    const statusResults = await Ticket.aggregate([
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

    const totalTicketDocs = await Ticket.countDocuments();

    res.json({
      countsByDate,
      ticketStatusCounts,
      totalTicketDocs,
    });
  } catch (error) {
    console.error("Error in getTicketStats:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get all tickets
exports.getAllTickets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortField = "createdAt",
      sortOrder = -1,
      startDate,
      endDate,
      status,
    } = req.query;
    const userId = req.user.userId;

    const result = await ticketService.getTickets(
      page,
      limit,
      search,
      sortField,
      sortOrder,
      startDate,
      endDate,
      status,
      userId
    );

    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("getAllTickets error:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single ticket
exports.getTicket = async (req, res) => {
  try {
    const result = await ticketService.getTicketById(req.params.id);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("getTicket error:", error);
    const status =
      error.message === "Ticket not found"
        ? HTTP_STATUS_CODES.NOT_FOUND
        : HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
};

// Create ticket using AI
exports.aiCreateTicket = async (req, res) => {
  try {
    const ticketData = {
      ...req.body,
      created_by: req.user.userId,
      isAIGenerated: true,
    };

    const result = await ticketService.createTicket(ticketData);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("aiCreateTicket error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Update ticket location
exports.updateTicketLocation = async (req, res) => {
  try {
    const result = await ticketService.updateTicketLocation(
      req.params.id,
      req.body
    );
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("updateTicketLocation error:", error);
    const status =
      error.message === "Ticket not found"
        ? HTTP_STATUS_CODES.NOT_FOUND
        : HTTP_STATUS_CODES.BAD_REQUEST;
    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
};

// Send repair request
exports.sendRepairRequest = async (req, res) => {
  try {
    const result = await ticketService.sendRepairRequest(
      req.params.id,
      req.body
    );
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("sendRepairRequest error:", error);
    const status =
      error.message === "Ticket not found"
        ? HTTP_STATUS_CODES.NOT_FOUND
        : HTTP_STATUS_CODES.BAD_REQUEST;
    res.status(status).json({
      success: false,
      message: error.message,
    });
  }
};

// Get ticket statistics
exports.getTicketStats = async (req, res) => {
  try {
    const clientId = req.query.clientId || null;
    const result = await ticketService.getTicketCount(clientId);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("getTicketStats error:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

// Get active tickets
exports.getActiveTickets = async (req, res) => {
  try {
    const { clientId, limit } = req.query;
    const result = await ticketService.getActiveTickets(clientId, limit);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("getActiveTickets error:", error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: error.message,
    });
  }
};

// VAPI Create Ticket - handles VAPI function calls
exports.vapiCreateTicket = async (req, res) => {
  try {
    console.log("🎫 VAPI Create Ticket Request");

    // Check if this is a VAPI function call
    if (req.body.message && req.body.message.toolCalls) {
      // Extract function call parameters from VAPI request (new format)
      const toolCalls = req.body.message.toolCalls;
      const toolCall = toolCalls[0];
      const tool_id = toolCall.id;
      const functionCall = toolCall.function;
      const parameters = functionCall.arguments;
      const call = req.body.message.call;

      console.log("📋 Creating ticket with parameters:", parameters);

      // Extract assistant ID from the call
      const assistantId = call?.assistantId;
      if (!assistantId) {
        console.error("❌ No assistant ID found in VAPI request");
        return res.status(200).json({
          results: [
            {
              toolCallId: tool_id,
              result: JSON.stringify({
                success: false,
                message: "Assistant ID not found in request",
              }),
            },
          ],
        });
      }

      console.log("🤖 Looking up organization for assistant ID:", assistantId);

      // Find the AI config using the assistant ID (inbound_assistant_id)
      const AIConfig = require("../models/ai-config.model");
      const aiConfig = await AIConfig.findOne({
        inbound_assistant_id: assistantId,
      }).populate("organization_id");

      if (!aiConfig) {
        console.error("❌ No AI config found for assistant ID:", assistantId);
        return res.status(200).json({
          results: [
            {
              toolCallId: tool_id,
              result: JSON.stringify({
                success: false,
                message: "Configuration not found for this assistant",
              }),
            },
          ],
        });
      }

      // Find the organization owner (user) to get their API key
      const Organization = require("../models/organization.model");
      const User = require("../models/user.model");

      const organization = await Organization.findById(
        aiConfig.organization_id
      ).populate("owner");

      if (!organization || !organization.owner || !organization.owner.apiKey) {
        console.error("❌ Organization owner or API key not found");
        return res.status(200).json({
          results: [
            {
              toolCallId: tool_id,
              result: JSON.stringify({
                success: false,
                message: "Organization configuration incomplete",
              }),
            },
          ],
        });
      }

      const apiKey = organization.owner.apiKey;
      console.log("🔑 Found API key for organization owner");

      // Get customer phone number from the call
      const customerPhone =
        call?.customer?.number || call?.customerNumber || "N/A";

      // Fetch policy details if policy_number is provided
      let policyData = null;
      if (parameters.policy_number) {
        console.log(
          "🔍 Fetching policy details for:",
          parameters.policy_number
        );

        const Policy = require("../models/policy.model");
        policyData = await Policy.findOne({
          policy_number: {
            $regex: `^${parameters.policy_number}$`,
            $options: "i",
          },
        });

        if (policyData) {
          console.log("✅ Policy found:", {
            policy_number: policyData.policy_number,
            insured_name: `${policyData.insured_first_name} ${policyData.insured_last_name}`,
            expiration: policyData.policy_expiration_date,
          });
        } else {
          console.log(
            "⚠️ Policy not found for number:",
            parameters.policy_number
          );
        }
      }

      // Categorize breakdown reason using OpenAI
      let categorizedBreakdownReason = [
        { label: "Other", key: "other", idx: 8 },
      ];
      if (parameters.breakdown_reason) {
        console.log(
          "🤖 Categorizing breakdown reason:",
          parameters.breakdown_reason
        );
        categorizedBreakdownReason = await categorizeBreakdownReason(
          parameters.breakdown_reason
        );
        console.log(
          "✅ Breakdown reason categorized:",
          categorizedBreakdownReason
        );
      }

      // Determine country code from customer phone number
      const { number, ...cellCountryCode } =
        getCountryFromPhoneNumber(customerPhone);

      // Map VAPI parameters to ticket data structure for the regular endpoint
      const ticketData = {
        // Basic customer info - use policy data if available
        insured_name:
          parameters.customer_name ||
          (policyData
            ? `${policyData.insured_first_name || ""} ${
                policyData.insured_last_name || ""
              }`.trim()
            : "N/A"),
        current_cell_number: number,
        cell_country_code: cellCountryCode,

        // Policy info - populated from policy data
        policy_number: parameters.policy_number || null,
        policy_expiration_date: policyData?.policy_expiration_date || null,
        policy_address: policyData
          ? [
              policyData.risk_address_line_1,
              policyData.risk_address_city,
              policyData.risk_address_state,
              policyData.risk_address_zip_code,
            ]
              .filter(Boolean)
              .join(", ")
          : null,
        agency_name: policyData?.agency_name || null,

        // Vehicle information - use VAPI params or fall back to policy data
        vehicle_make:
          parameters.vehicle_make ||
          policyData?.vehicles?.[0]?.vehicle_manufacturer ||
          "N/A",
        vehicle_model:
          parameters.vehicle_model ||
          policyData?.vehicles?.[0]?.vehicle_model ||
          "N/A",
        vehicle_color:
          parameters.vehicle_color ||
          policyData?.vehicles?.[0]?.vehicle_color ||
          "N/A",
        vehicle_year:
          parameters.vehicle_year ||
          policyData?.vehicles?.[0]?.vehicle_model_year ||
          null,
        vehicle_type: parameters.vehicle_type || "N/A",
        license_plate_no:
          parameters.license_plate ||
          policyData?.vehicles?.[0]?.licensePlate ||
          null,

        // Service details with OpenAI categorized breakdown reason
        breakdown_reason: categorizedBreakdownReason,
        breakdown_reason_text: parameters.breakdown_reason || "N/A",
        service_type: parameters.service_type || "roadside_repair",
        tow_destination: parameters.tow_destination || null,

        // Scheduling
        scheduled_time:
          parameters.schedule_time === "immediate"
            ? new Date()
            : parameters.schedule_time,

        // Payment and policy status
        is_self_pay: parameters.is_self_pay || false,
        policy_valid: parameters.policy_valid || false,

        // Status and tracking
        status: "created",
        breakdown_address: parameters.breakdown_address || null,
        coord: parameters.coord || null,
        assignedByAi: true,
      };

      console.log("📝 Prepared ticket data for regular endpoint:", {
        policy_number: ticketData.policy_number,
        insured_name: ticketData.insured_name,
        vehicle_make: ticketData.vehicle_make,
        vehicle_model: ticketData.vehicle_model,
        breakdown_reason: ticketData.breakdown_reason,
        has_policy_data: !!policyData,
        cell_country_code: ticketData.cell_country_code,
      });

      // Make authenticated request to the regular ticket creation endpoint
      const axios = require("axios");
      const SERVER_URL = process.env.SERVER_URL;

      try {
        const response = await axios.post(
          `${SERVER_URL}/api/v1/tickets`,
          ticketData,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              "X-API-Key": apiKey,
            },
            timeout: 30000, // 30 second timeout
          }
        );

        console.log(
          "✅ Ticket created successfully via regular endpoint:",
          response.data
        );

        // Return VAPI-compatible success response
        return res.status(200).json({
          results: [
            {
              toolCallId: tool_id,
              result: JSON.stringify({
                success: true,
                ticket: response.data,
                message:
                  "Your service ticket has been created successfully. You will receive a text message with a form to provide your exact location.",
                next_steps:
                  "Please fill out the location form when you receive the text message.",
                policy_found: !!policyData,
                insured_name: ticketData.insured_name,
              }),
            },
          ],
        });
      } catch (apiError) {
        console.error(
          "❌ Error calling regular ticket endpoint:",
          apiError.response?.data || apiError.message
        );

        // Return detailed error for debugging
        return res.status(200).json({
          results: [
            {
              toolCallId: tool_id,
              result: JSON.stringify({
                success: false,
                message:
                  "Failed to create ticket. Please try again or contact support.",
                error: apiError.response?.data?.message || apiError.message,
              }),
            },
          ],
        });
      }
    } else {
      // Handle direct API calls (non-VAPI) - fallback to original logic
      return res.status(400).json({
        success: false,
        message:
          "This endpoint is designed for VAPI function calls. Please use the standard ticket creation endpoint.",
      });
    }
  } catch (error) {
    console.error("❌ VAPI Create Ticket Error:", error);

    // Return VAPI-compatible error response
    return res.status(200).json({
      results: [
        {
          toolCallId: "unknown",
          result: JSON.stringify({
            success: false,
            message:
              "An error occurred while creating your service ticket. Please try again or contact support.",
            error: error.message,
          }),
        },
      ],
    });
  }
};

// Function to determine country code from phone number
const getCountryFromPhoneNumber = (phoneNumber) => {
  try {
    const { parsePhoneNumber } = require("libphonenumber-js");

    // Parse the phone number
    const parsedNumber = parsePhoneNumber(phoneNumber);

    if (parsedNumber && parsedNumber.country) {
      const countryInfo = {
        label: parsedNumber.country,
        id: parsedNumber.country,
        dialCode: `+${parsedNumber.countryCallingCode}`,
        number: parsedNumber.nationalNumber,
      };

      console.log(
        `🌍 Country detected: ${countryInfo.label} (${countryInfo.dialCode})`
      );
      return countryInfo;
    } else {
      // Default to US if parsing fails
      console.log("🌍 Phone number parsing failed, defaulting to US (+1)");
      return { label: "US", id: "US", dialCode: "+1" };
    }
  } catch (error) {
    console.error(
      "❌ Error determining country from phone number:",
      error.message
    );
    // Default to US if any error occurs
    return { label: "US", id: "US", dialCode: "+1" };
  }
};

// GET TICKET TERMS & CONDITIONS --------SYSTERM USERS ONLY-------
exports.getTicketTerms = async (req, res) => {
  try {
    const clientId = req.params.clientId || req.query.clientId;
    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or missing clientId" });
    }

    const userOrg = await Organization.findOne({
      $or: [{ owner: clientId }, { "members.user": clientId }],
    });

    const orgId = userOrg?._id;

    const setting = await Terms.findOne({
      client: orgId || clientId,
    }).lean();
    if (!setting) {
      return res.json({
        success: true,
        data: {
          content: DEFAULT_TERMS,
          createdAt: null,
          updatedAt: null,
          client: orgId || clientId,
        },
      });
    }

    // Found existing custom terms
    return res.json({
      success: true,
      data: {
        id: setting._id.toString(),
        content: setting.content,
        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt,
        client: setting.client,
      },
    });
  } catch (err) {
    console.error("getTicketTerms error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// SAVE/UPDATE TICKET TERMS & CONDIs ------SYS LEVEL USERS ONLY-----------
exports.updateTicketTerms = async (req, res) => {
  try {
    const owner = req.user.userId;
    const user = await User.findById(owner);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }
    const userRoleDoc = await Role.findById(user.role_id);
    const adminRole = userRoleDoc?.name;
    if (adminRole !== "super_admin" && adminRole !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Insufficient permissions" });
    }

    const { clientId, content } = req.body;
    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or missing clientId" });
    }
    if (typeof content !== "string" || content.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Content is required" });
    }

    // Find existing for this client
    let setting = await Terms.findOne({
      key: "ticketSubmissionTerms",
      client: clientId,
    });
    if (!setting) {
      setting = new Terms({
        client: clientId,
        content: content.trim(),
      });
    } else {
      setting.content = content.trim();
    }

    await setting.save();

    return res.json({
      success: true,
      data: {
        id: setting._id.toString(),
        content: setting.content,
        client: setting.client,
        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt,
      },
    });
  } catch (err) {
    console.error("updateTicketTerms error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.geoLocateTicket = async (req, res) => {
  try {
    const { breakdown_address } = req.body;
    if (!breakdown_address || typeof breakdown_address !== "object") {
      return res.status(400).json({
        success: false,
        message: "breakdown_address object is required",
      });
    }

    const parts = [];
    if (breakdown_address.street) parts.push(breakdown_address.street.trim());
    if (breakdown_address.city) parts.push(breakdown_address.city.trim());
    if (breakdown_address.state)
      parts.push(breakdown_address.state.trim().slice(0, 2)); // PA
    if (breakdown_address.zipcode) parts.push(breakdown_address.zipcode.trim());
    // parts.push("USA");

    const addressString = parts.join(", ");
    console.log("Geocoding:", addressString);

    const coord = await geocodeAddress(addressString);
    console.log("Geocoder response:", coord);

    if (coord && coord.latitude != null && coord.longitude != null) {
      return res.json({ success: true, data: coord });
    } else {
      console.warn("Unable to geocode:", addressString);
      return res.status(400).json({
        success: false,
        message: `Unable to geocode address: "${addressString}". See server logs for details.`,
      });
    }
  } catch (error) {
    console.error("Error in geoLocateTicket:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while geolocating address",
    });
  }
};

// Assign Provider to Ticket
exports.assignProviderToTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { providerId } = req.body;
    const userId = req.user.userId;

    // Validate input
    if (!providerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields",
          details: [
            {
              field: "providerId",
              message: "Provider ID is required",
            },
          ],
        },
      });
    }

    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid ticket ID",
        },
      });
    }

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid provider ID",
        },
      });
    }

    // Get user's organization
    const userOrg = await Organization.findOne({
      $or: [{ owner: userId }, { "members.user": userId }],
    });

    if (!userOrg) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "User organization not found",
        },
      });
    }

    // Check if ticket exists and belongs to user's organization
    const ticket = await Ticket.findOne({
      _id: ticketId,
      organization_id: userOrg._id,
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Ticket not found or unauthorized",
        },
      });
    }

    // Check if provider (mechanic) exists
    const provider = await Mechanic.findById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Service provider not found",
        },
      });
    }

    // Check organization permissions
    const perms = await getMechanicPermissions(userOrg._id);
    const { primaryMechanic, secondaryMechanic, allMechanics } = perms;

    if (primaryMechanic) {
      // Only allow assignment if mechanic belongs to user's organization
      if (
        !provider.organization_id ||
        provider.organization_id.toString() !== userOrg._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          error: {
            code: "PERMISSION_DENIED",
            message: "Cannot assign a provider outside your organization",
          },
        });
      }
    } else if (!secondaryMechanic && !allMechanics) {
      return res.status(403).json({
        success: false,
        error: {
          code: "PERMISSION_DENIED",
          message: "Provider assignment not permitted by organization settings",
        },
      });
    }

    // Update ticket with assigned provider
    const updatedTicket = await Ticket.findByIdAndUpdate(
      ticketId,
      {
        assigned_subcontractor: new mongoose.Types.ObjectId(providerId),
        status: "assigned",
        auto_assigned_at: new Date(),
        auto_assigned_by: userId.toString(),
      },
      { new: true }
    ).populate(
      "assigned_subcontractor",
      "firstName lastName businessName email phoneNumber"
    );

    res.status(200).json({
      success: true,
      message: "Service provider assigned to ticket successfully",
      data: {
        ticketId: ticketId,
        providerId: providerId,
        assignedAt: updatedTicket.auto_assigned_at,
        assignedBy: userId,
        status: "assigned",
      },
    });
  } catch (error) {
    console.error("Error in assignProviderToTicket:", error);
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
    });
  }
};

exports.declineRequest = async (req, res) => {
  try {
    const requestId = req.params;
    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid request id is required" });
    }

    const updated = await ticketService.declineRequestService(requestId);

    return res.status(200).json({
      success: true,
      message: "Request declined successfully",
      data: { request: updated },
    });
  } catch (error) {
    console.error("Error in declineRequest controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to decline request",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const requestId = req.params;
    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res
        .status(400)
        .json({ success: false, message: "Valid request id is required" });
    }

    const approved = await ticketService.approveRequestService(requestId);

    return res.status(200).json({
      success: true,
      message:
        "Request approved successfully; other requests updated to declined",
      data: { request: approved },
    });
  } catch (error) {
    console.error("Error in approveRequest controller:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve request",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
