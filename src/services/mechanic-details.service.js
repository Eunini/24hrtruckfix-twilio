const { Mechanic, User, MechanicDetails } = require("../models");
const {
  Agent,
  run,
  setDefaultOpenAIKey,
  webSearchTool,
  tool,
} = require("@openai/agents");
const { z } = require("zod");
const { getJson } = require("serpapi");

setDefaultOpenAIKey(process.env.OPENAI_API_KEY);

const serpApi = tool({
  name: "get_acccurate_urls",
  description:
    "This is used to retrieve accurate URLs that we can then pass to the websearch tool",
  strict: false,
  parameters: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
    additionalProperties: true,
  },
  execute: async (input) => {
    // Validate input due to strict: false
    if (typeof input !== "object" || input === null || !("text" in input)) {
      return "Invalid input. Please try again";
    }

    let result = [];
    try {
      await getJson(
        {
          engine: "google",
          q: input.text,
          api_key:
            "3334b45a6579e1e62c2082ecdc25779b202d50ddb54951f39b6d255fb912bd07",
        },
        (json) => {
          result = json["organic_results"];
        }
      );

      return result;
    } catch (error) {
      console.error("SerpAPI error:", error);
      return [];
    }
  },
});
const agent = new Agent({
  name: "Sp Research Agent",
  instructions: `
  You are a research agent. You need to research a mechanic/service provider and provide a comprehensive summary. 
    Focus on finding:
    - Social media profiles (Facebook, Instagram, LinkedIn, etc.)
    - Google reviews and ratings
    - Better Business Bureau ratings
    - Any negative reviews or complaints
    - Professional associations or certifications
    - Years in business
    - Service areas and specializations
    - Contact information verification
    - Overall reputation assessment
    
    Provide a detailed but concise summary of your findings.`,
  model: "gpt-4o-mini",
  modelSettings: {
    temperature: 0,
  },
  tools: [webSearchTool(), serpApi],
});

// AI Research Agent function
const researchMechanic = async (
  mechanicEmail,
  mechanicName,
  businessName,
  mechanicPhone
) => {
  try {
    const searchQuery =
      `${mechanicEmail} ${mechanicName} ${businessName} mechanic reviews ratings social media profile google maps listing`.trim();

    const result = await run(
      agent,
      `Research this mechanic/service provider: ${searchQuery}. 
          Email: ${mechanicEmail}
          Name: ${mechanicName}
          Business: ${businessName}

          If you are not able find any detail about the mechanic/service provider please try searching with the number ${mechanicPhone}
          Provide a comprehensive research summary including social media presence, reviews, ratings, and overall reputation.`
    );

    return result.finalOutput;
  } catch (error) {
    console.error("AI Research error:", error);
    return `Basic research profile created for ${mechanicName} (${mechanicEmail}). Business: ${businessName}. Further details to be researched manually.`;
  }
};

// Create new mechanic details
exports.createMechanicDetails = async (mechanicId, createdBy) => {
  // Validate mechanic exists
  const mechanic = await Mechanic.findById(mechanicId);
  if (!mechanic) {
    throw new Error("Mechanic not found");
  }

  const details = await researchMechanic(
    mechanic.email,
    mechanic.firstName + " " + mechanic.lastName,
    mechanic.businessName || mechanic.companyName,
    mechanic.businessNumber || mechanic.mobileNumber
  );

  // Validate required fields
  if (!details || details.trim().length === 0) {
    throw new Error("Details are required and cannot be empty");
  }

  // Create new mechanic details
  const mechanicDetails = await MechanicDetails.create({
    mechanicId,
    details: details.trim(),
    createdBy,
  });

  // Populate references before returning
  await mechanicDetails.populate([
    { path: "mechanicId", select: "firstName lastName email businessName" },
    { path: "createdBy", select: "firstname lastname email" },
  ]);

  return mechanicDetails;
};

// Get all details for a specific mechanic
exports.getMechanicDetailsByMechanicId = async (
  mechanicId,
  page = 1,
  limit = 10
) => {
  // Validate mechanic exists
  const mechanic = await Mechanic.findById(mechanicId);
  if (!mechanic) {
    throw new Error("Mechanic not found");
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 }, // Most recent first
    populate: [
      {
        path: "mechanicId",
        select: "firstName lastName email businessName companyName",
      },
      { path: "createdBy", select: "firstname lastname email" },
    ],
  };

  const mechanicDetails = await MechanicDetails.paginate(
    { mechanicId },
    options
  );

  return mechanicDetails;
};

// Get a single mechanic detail by ID
exports.getMechanicDetailById = async (detailId) => {
  const mechanicDetail = await MechanicDetails.findById(detailId).populate([
    {
      path: "mechanicId",
      select: "firstName lastName email businessName companyName",
    },
    { path: "createdBy", select: "firstname lastname email" },
  ]);

  if (!mechanicDetail) {
    throw new Error("Mechanic detail not found");
  }

  return mechanicDetail;
};

// Get all mechanic details (admin view)
exports.getAllMechanicDetails = async (page = 1, limit = 10, search = "") => {
  const query = {};

  // Add search functionality if search term is provided
  if (search && search.trim().length > 0) {
    query.$or = [{ details: { $regex: search.trim(), $options: "i" } }];
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 },
    populate: [
      {
        companyName,
        path: "mechanicId",
        select: "firstName lastName email businessName companyName",
      },
      { path: "createdBy", select: "firstname lastname email" },
    ],
  };

  const mechanicDetails = await MechanicDetails.paginate(query, options);

  return mechanicDetails;
};

// Update mechanic details
exports.updateMechanicDetails = async (detailId, details, updatedBy) => {
  const mechanicDetail = await MechanicDetails.findById(detailId);

  if (!mechanicDetail) {
    throw new Error("Mechanic detail not found");
  }

  // Validate details
  if (!details || details.trim().length === 0) {
    throw new Error("Details are required and cannot be empty");
  }

  // Update the details
  mechanicDetail.details = details.trim();
  mechanicDetail.updatedAt = new Date();

  await mechanicDetail.save();

  // Populate and return
  await mechanicDetail.populate([
    { path: "mechanicId", select: "firstName lastName email businessName" },
    { path: "createdBy", select: "firstname lastname email" },
  ]);

  return mechanicDetail;
};

// Delete mechanic details
exports.deleteMechanicDetails = async (detailId) => {
  const mechanicDetail = await MechanicDetails.findByIdAndDelete(detailId);

  if (!mechanicDetail) {
    throw new Error("Mechanic detail not found");
  }

  return mechanicDetail;
};
