const UserSubContractorModel = require("../models/usersSubContractors");
const { getMongoConnection } = require("../../../loaders/mongo/connect");

exports.searchSubcontractorsByTerm = async (searchTerm) => {
  console.log("searchSubcontractorsByTerm search_str", searchTerm);
  let result = null;
  try {
    await getMongoConnection();
    console.log("searchTerm", searchTerm);
    const stringSearchFields = ["first_name", "last_name", "email"];

    const query = {
      $or: [
        ...stringSearchFields.map((field) => ({
          [field]: new RegExp("^" + searchTerm, "i"),
        })),
      ],
    };

    result = await UserSubContractorModel.find(
      query,
      "first_name last_name email"
    ).limit(10);
    console.log("result", result);
    return result;
  } catch (ex) {
    console.error("exception searchSubcontractorsByTerm", ex);
  }
  return result;
};

exports.getSubcontractors = async (page = 0, limit = 200) => {
  const query = {};
  const options = {
    select: "first_name last_name email id",
    page,
    limit,
  };

  let result = null;
  try {
    await getMongoConnection();
    result = await UserSubContractorModel.aggregate([
      {
        $project: {

          label: {
            $concat: [
              "$email",
              " - ",
              "$first_name",
              " ",
              "$last_name",
            ],
          },
        },
      },
    ]).exec();

    return result?.length ? result.map(res => ({...res, id: res._id})) : [];
  } catch (ex) {
    console.error("exception result", ex);
  }
  return result;
};
