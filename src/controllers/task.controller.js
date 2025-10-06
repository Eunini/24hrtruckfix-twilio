const { default: mongoose } = require("mongoose");
const { Organization, Task, Ticket } = require("../models");
const { notifyOnTaskCreation, RequestTask } = require("../services/task.service");

exports.getTasks = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, ticketId, tag } = req.query;
    const { userId, adminRole } = req.user;

    const query = {};

    if (adminRole !== "admin" && adminRole !== "super_admin") {
      const userOrganizations = await Organization.find({
        $or: [{ "members.user": userId }],
      }).select("_id");

      if (!userOrganizations.length) {
        return res.status(200).json({ tasks: { docs: [], totalDocs: 0 } });
      }
      const orgIds = userOrganizations.map((org) => org._id);
      query.organization_id = { $in: orgIds };
    }

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    if (tag) {
      query.tag = tag;
    }

    // Filter by ticketId if provided
    if (ticketId && mongoose.Types.ObjectId.isValid(ticketId)) {
      query.ticket_id = ticketId;
    }

    const options = {
      page: Number.parseInt(page, 10),
      limit: Number.parseInt(limit, 10),
      sort: { createdAt: -1 },
      populate: [
        { path: "organization_id", select: "companyName name" },
        { path: "ticket_id", select: "policy_number updatedAt createdAt" },
      ],
    };

    const tasks = await Task.paginate(query, options);
    res.status(200).json({ tasks });
  } catch (error) {
    console.error("Error in getTasks:", error);
    res.status(500).json({ message: "Server error while fetching tasks." });
  }
};

exports.createTask = async (req, res) => {
  try {
    const { title, description, tag, ticketId } = req.body;

    if (!title || !ticketId) {
      return res
        .status(400)
        .json({ message: "Title and ticketId are required." });
    }

    // Validate ticketId
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      return res.status(400).json({ message: "Invalid ticketId format." });
    }

    // Validate tag
    const validTags = [
      "Generic",
      "Find SPs",
      "Modify Work Order",
      "Contact Client",
    ];
    if (!validTags.includes(tag)) {
      return res.status(400).json({ message: "Invalid tag value." });
    }

    // Find the associated ticket to get its organization_id
    const ticket = await Ticket.findById(ticketId).select("organization_id");
    if (!ticket) {
      return res.status(404).json({ message: "Associated ticket not found." });
    }

    const newTask = new Task({
      title,
      description,
      tag,
      status: "pending",
      ticket_id: ticketId,
      organization_id: ticket.organization_id,
      resolvedAt: null,
    });

    await newTask.save();

    const populatedTask = await Task.findById(newTask._id)
      .populate("organization_id", "companyName name")
      .populate("ticket_id", "policy_number updatedAt createdAt");

    res
      .status(201)
      .json({ message: "Task created successfully.", task: populatedTask });

    await notifyOnTaskCreation(populatedTask).catch((err) => {
      console.error("Error notifying on task creation:", err);
    });
  } catch (error) {
    console.error("Error in createTask:", error);
    res.status(500).json({ message: "Server error while creating the task." });
  }
};

exports.getTicketsByOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { userId, adminRole } = req.user;

    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return res
        .status(400)
        .json({ message: "Invalid organization ID format." });
    }

    if (adminRole !== "admin" && adminRole !== "super_admin") {
      const userOrganizations = await Organization.find({
        $or: [{ "members.user": userId }],
      }).select("_id");

      const orgIds = userOrganizations.map((org) => org._id.toString());
      if (!orgIds.includes(organizationId)) {
        return res
          .status(403)
          .json({ message: "Access denied to this organization's tickets." });
      }
    }

    const tickets = await Ticket.find({ organization_id: organizationId })
      .select(
        "policy_number breakdown_reason_text license_plate_no description updatedAt"
      )
      .sort({ updatedAt: -1 })
      .limit(1000);

    res.status(200).json({ tickets });
  } catch (error) {
    console.error("Error in getTicketsByOrganization:", error);
    res.status(500).json({
      message: "Server error while fetching tickets for organization.",
    });
  }
};

exports.changeTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    const validStatuses = ["pending", "in-progress", "completed", "cancelled"];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid or missing status." });
    }

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid taskId format." });
    }

    const updatePayload = { status };
    if (status === "completed") {
      updatePayload.resolvedAt = new Date();
    }

    const updatedTask = await Task.findByIdAndUpdate(taskId, updatePayload, {
      new: true,
    })
      .populate("organization_id", "companyName name")
      .populate("ticket_id", "policy_number");

    if (!updatedTask) {
      return res.status(404).json({ message: "Task not found." });
    }

    res.status(200).json({
      message: "Task status updated successfully.",
      task: updatedTask,
    });
  } catch (error) {
    console.error("Error in changeTaskStatus:", error);
    res
      .status(500)
      .json({ message: "Server error while updating task status." });
  }
};

exports.completeTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid taskId format." });
    }

    const updatePayload = {
      status: "completed",
      resolvedAt: new Date(),
    };

    const completedTask = await Task.findByIdAndUpdate(taskId, updatePayload, {
      new: true,
    })
      .populate("organization_id", "companyName name")
      .populate("ticket_id", "policy_number");

    if (!completedTask) {
      return res.status(404).json({ message: "Task not found." });
    }

    res
      .status(200)
      .json({ message: "Task marked as completed.", task: completedTask });
  } catch (error) {
    console.error("Error in completeTask:", error);
    res
      .status(500)
      .json({ message: "Server error while completing the task." });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ message: "Invalid taskId format." });
    }

    const deletedTask = await Task.findByIdAndDelete(taskId);

    if (!deletedTask) {
      return res.status(404).json({ message: "Task not found." });
    }

    res.status(200).json({ message: "Task deleted successfully." });
  } catch (error) {
    console.error("Error in deleteTask:", error);
    res.status(500).json({ message: "Server error while deleting the task." });
  }
};

exports.requestAITask = async (req, res) => {
  const data = req.body;
  if (!data) return res.status(400).json({ error: 'no data provided' });
  console.log({data})

  try {
    const task = await RequestTask(data);
    return res.status(201).json(task);
  } catch (err) {
    console.error('Task for request failed:', err);
    return res.status(500).json({ error: 'task creation failed' });
  }
}

exports.markNewRequestFalse = async (req, res) => {
  const {ticket_id} = req.params;
  if (!ticket_id) return res.status(400).json({ error: 'no ticket id provided' });

  try {
    const task = await Ticket.findByIdAndUpdate(
        ticket_id,
        {$set: { new_request: false }},
        { new: true }
      ).exec();
    
    if (!task) return res.status(404).json({ error: 'ticket not found' });

    return res.status(200).json({ new_request: !!task.new_request});
  } catch (err) {
    console.error('Status Change for request failed:', err);
    return res.status(500).json({ error: 'status change failed' });
  }
}
