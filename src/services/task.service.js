const {
  Task,
  Ticket,
  Mechanic,
  Organization,
  Role,
  User,
  Policy,
} = require("../models");
const taskTemplates = require("./ai/taskTemplate");
const { sendTaskAssignedEmail } = require("./mail/approvalmail");

async function notifyOnTaskCreation(task) {
  const [agentRole, adminRole, superAdminRole] = await Promise.all([
    Role.findOne({ name: "agent" }).lean(),
    Role.findOne({ name: "admin" }).lean(),
    Role.findOne({ name: "super_admin" }).lean(),
  ]);
  if (!agentRole || !adminRole || !superAdminRole) {
    console.warn("One of the roles (agent/admin/super_admin) was not found");
    return;
  }

  // get the org
  const org = await Organization.findById(
    task.organization_id,
    "members"
  ).lean();
  const memberIds = Array.isArray(org?.members)
    ? org.members.map((m) => m.user)
    : [];

  // agents in the org
  const agents = await User.find({
    _id: { $in: memberIds },
    role_id: agentRole._id,
  })
    .select("email firstname lastname")
    .lean();

  // Admins & Super Admins
  const admins = await User.find({
    role_id: { $in: [adminRole._id, superAdminRole._id] },
  })
    .select("email firstname lastname")
    .lean();

  // suport email
  const service = { email: "service@24hrtruckfix.com", firstname: "Support" };

  // merge by email
  const combined = [service, ...agents, ...admins];
  const deduped = Object.values(
    combined.reduce((acc, u) => {
      if (u.email) acc[u.email] = u;
      return acc;
    }, {})
  );

  const primary = service.email;
  const bccList = deduped.map((u) => u.email).filter((e) => e !== primary);

  // send each an email
  await sendTaskAssignedEmail({
    toEmail: primary,
    bccList,
    recipientName: "Support Team",
    clientName: 
      task.organization_id.companyName || task.companyName || org.companyName || "Your Client",
    taskTitle: task.title || "Task title",
    taskDescription: task.description || "No description provided",
  });
}

async function createTasksForTrigger(triggerKey, context = {}) {
  const templates = taskTemplates[triggerKey] || [];
  if (!templates.length) return;

  const render = (str) =>
    Object.entries(context)
      .reduce((txt, [k, v]) => txt.replace(new RegExp(`\\$${k}`, "g"), v), str)
      .trim();

  const docs = templates.map((tpl) => ({
    title: render(tpl.title),
    description: render(tpl.description),
    tag: tpl.tag,
    ticket_id: context.ticket_id,
    organization_id: context.organization_id,
  }));
  const newTask = await Task.insertMany(docs);
  const ids = newTask.map((t) => t._id);
  const populatedTask = await Task.findById(ids)
  .populate("organization_id", "companyName name")
  .populate("ticket_id", "policy_number updatedAt createdAt");
  
  // console.log({populatedTask})
  await notifyOnTaskCreation(populatedTask).catch((err) => {
    console.error("Error notifying on task creation:", err);
  });
}

async function handleEtaExpired(ticketId) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return;

  // Skip if ETA was removed or not reached
  if (!ticket.eta || Date.now() < ticket.eta.getTime()) return;

  // Skip if status is one of the excluded ones
  const blockedStatuses = ["cancelled", "completed", "archived"];
  if (blockedStatuses.includes(ticket.status)) return;

  if (ticket.status === "in-progress") {
    const breakdownReason =
      ticket.breakdown_reason?.[0]?.label?.toLowerCase() || "";
    let delayMs;
    switch (breakdownReason) {
      case "flat tire":
      case "battery replacement":
      case "jump start":
      case "fuel delivery":
      case "tire replacement":
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
        console.log(
          `Unknown breakdown reason: ${breakdownReason}. Skipping confirmation cadence.`
        );
        return;
    }

    // Schedule the task
    setTimeout(() => {
      handleCadence(ticket._id);
    }, delayMs);
  } else {
    const taskAlreadyExists = await Task.exists({
      ticket_id: ticket?._id,
      title: "ETA Expired: Confirm SP Arrival",
    });
    if (taskAlreadyExists) return;

    const mechanic = await Mechanic.findById(
      ticket?.assigned_subcontractor
    ).lean();
    const client = await Organization.findById(ticket?.organization_id).lean();
    const formatEtaToHourMinute = (dateLike) =>
      dateLike ? new Date(dateLike).toLocaleTimeString(undefined, 
        { hour: "numeric", minute: "2-digit", hour12: true, }).replace(/\s+/g, "").toUpperCase() : "";
    function formatEtaDiff(eta, updatedAt) {
      if (!eta || !updatedAt) return null;
    
      const start = new Date(updatedAt); // when ticket was last updated/created
      const target = new Date(eta);      // ETA deadline
      let diffMs = target.getTime() - start.getTime();
    
      if (diffMs < 0) diffMs = 0;
    
      // 👉 Handle less than a minute
      if (diffMs > 0 && diffMs < 60 * 1000) {
        return "less than a minute";
      }
    
      const totalMinutes = Math.ceil(diffMs / (1000 * 60)); // round up
      const minutes = totalMinutes % 60;
      const hours = Math.floor(totalMinutes / 60) % 24;
      const days = Math.floor(totalMinutes / (60 * 24));
    
      if (days > 0 && hours > 0) {
        return `${days} day${days > 1 ? "s" : ""} ${hours} hour${hours > 1 ? "s" : ""}`;
      }
      if (days > 0) {
        return `${days} day${days > 1 ? "s" : ""}`;
      }
      if (hours > 0 && minutes > 0) {
        return `${hours} hour${hours > 1 ? "s" : ""} ${minutes} minute${minutes > 1 ? "s" : ""}`;
      }
      if (hours > 0) {
        return `${hours} hour${hours > 1 ? "s" : ""}`;
      }
      return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    }         
    const dta = {
      sp_name:
        mechanic?.companyName ||
        mechanic?.businessName ||
        `${mechanic?.firstName} ${mechanic?.lastName}`,
      sp_contact_phone:
        mechanic?.mobileNumber ||
        mechanic?.businessNumber ||
        mechanic?.office_num,
      client_contact_phone:
        ticket?.current_cell_number ||
        client?.keyBillingContactPhone ||
        client?.approverBillingContactPhone,
      client_location:
        `${ticket?.breakdown_address.street}, ${ticket?.breakdown_address.city}, ${ticket?.breakdown_address.state}` ||
        location,
      ticket_id: ticket?._id,
      organization_id: ticket?.organization_id,
      eta_time: ticket?.eta ? (formatEtaDiff(ticket.eta, ticket.updatedAt) || formatEtaToHourMinute(ticket.eta)) : "No ETA set",
    };

    await createTasksForTrigger("eta_expiry", dta);
  }
}

async function handleCadence(ticketId) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return;

  if (["cancelled", "completed", "archived"].includes(ticket.status)) return;

  // Skip if task already created
  const taskAlreadyExists = await Task.exists({
    ticket_id: ticket._id,
    title: "Confirmation Cadence: Check Job Status",
  });
  if (taskAlreadyExists) return;

  const mechanic = await Mechanic.findById(
    ticket?.assigned_subcontractor
  ).lean();
  const client = await Organization.findById(ticket?.organization_id).lean();
  const dto = {
    service_details:
      `${ticket?.services?.[0]?.name}, ${ticket?.services?.[0]?.cost}` ||
      ticket?.services,
    client_contact_phone:
      ticket?.current_cell_number ||
      client?.keyBillingContactPhone ||
      client?.approverBillingContactPhone,
    sp_name:
      mechanic?.companyName ||
      mechanic?.businessName ||
      `${mechanic?.firstName} ${mechanic?.lastName}`,
    ticket_id: ticket?._id,
    organization_id: ticket?.organization_id,
  };

  await createTasksForTrigger("confirm_cadence", dto);
}

async function RequestTask(data) {
  if (!data) return console.error("no data provided");
  // console.log({data})
  try {
    const ticket = await Ticket.findById(data.ticket_id);
    const owner = await Policy.findOne({ policy_number: ticket.policy_number});
    const fulldata = {
      ...data,
      organization_id: owner.organization_id 
    }
    const task = await createTasksForTrigger("request", fulldata);
    return task;
  }catch (err) {
    console.error("Task for request failed:", err);
  }

}

module.exports = {
  createTasksForTrigger,
  handleEtaExpired,
  handleCadence,
  notifyOnTaskCreation,
  RequestTask,
};
