const ServiceProviderModel = require("../models/service_provider");
const RoleModel = require("../models/roles");
const { getMongoConnection } = require("../../../loaders/mongo/connect");
const {
  Types: { ObjectId },
} = require("mongoose");

// Get all Service Providers
exports.getAllServiceProviders = async (
  page = 1,
  limit = 10,
  search = "",
  sortField = "createdAt",
  sort = -1,
  client_id = ""
) => {
  const query = { name: { $exists: true, $ne: "" } };

  if (search.trim()) {
    const searchTerms = search.split(" ").filter((term) => term.trim());
    query.$or = [];

    searchTerms.forEach((term) => {
      if (ObjectId.isValid(term)) {
        query.$or.push({ _id: ObjectId(term) });
      }

      const regexFields = ["name", "company", "specialty", "email", "phone", "location"];
      regexFields.forEach((field) => {
        query.$or.push({ [field]: { $regex: term, $options: "i" } });
      });

      const parsedDate = new Date(term);
      if (!isNaN(parsedDate.getTime())) {
        query.$or.push({
          createdAt: {
            $gte: new Date(parsedDate.setHours(0, 0, 0, 0)),
            $lt: new Date(parsedDate.setHours(23, 59, 59, 999)),
          },
        });
      }
    });
  }

  await getMongoConnection();

  if (client_id) {
    const roleData = await RoleModel.findById(client_id);
    if (roleData?.name !== "Admin") {
      query["assignedClients.client_id"] = ObjectId(client_id);
    }
  }

  try {
    const providers = await ServiceProviderModel.paginate(query, {
      page,
      limit,
      sort: { [sortField]: Number(sort) },
    });
    return providers;
  } catch (err) {
    console.error("getAllServiceProviders Error:", err);
    return null;
  }
};

// Create new Service Provider
exports.createNewServiceProvider = async (providerData) => {
  try {
    await getMongoConnection();

    const requiredFields = ["name", "email", "phone"];
    for (const field of requiredFields) {
      if (!providerData[field]) throw new Error(`${field} is required`);
    }

    const [existingEmail, existingPhone] = await Promise.all([
      ServiceProviderModel.findOne({ email: providerData.email }),
      ServiceProviderModel.findOne({ phone: providerData.phone }),
    ]);

    if (existingEmail) throw new Error("Email already exists");
    if (existingPhone) throw new Error("Phone number already exists");

    const newProvider = await ServiceProviderModel.create(providerData);
    return newProvider;
  } catch (err) {
    console.error("createNewServiceProvider Error:", err);
    throw err;
  }
};

// Get details by ID
exports.getServiceProviderById = async (id) => {
  try {
    await getMongoConnection();
    return await ServiceProviderModel.findById(id);
  } catch (err) {
    console.error("getServiceProviderById Error:", err);
    return null;
  }
};

// Update provider by ID
exports.updateServiceProvider = async (id, updates) => {
  try {
    await getMongoConnection();
    return await ServiceProviderModel.findByIdAndUpdate(id, updates, { new: true });
  } catch (err) {
    console.error("updateServiceProvider Error:", err);
    throw err;
  }
};

// Delete provider by ID
exports.deleteServiceProviderById = async (id) => {
  try {
    await getMongoConnection();
    return await ServiceProviderModel.findByIdAndDelete(id);
  } catch (err) {
    console.error("deleteServiceProviderById Error:", err);
    throw err;
  }
};
