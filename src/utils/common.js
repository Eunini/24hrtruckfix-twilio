const accountTypes = require("../assets/account-types.json");
const taskAccountTypes = require("../assets/task-account-type-mapping.json")
exports.parseBody = (event) => {
  let body;
  if (typeof event.body === "object") {
    body = event.body;
  } else {
    body = JSON.parse(event.body);
  }
  return body;
};

exports.accessTypesByAccount = async (type = 0) => {
  console.log("selected type", type);
  console.log("selected accountTypes", accountTypes);
  const filterTypes = accountTypes.filter((v) => v.id === type)?.[0];

  console.log("filterTypes", filterTypes.key);
  return filterTypes?.key ? taskAccountTypes[filterTypes.key]?.[0] : {}
};