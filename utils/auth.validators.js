const jwt = require("jsonwebtoken");

function getOptions(type) {
  let options;
  if (type === "refresh") {
    options = {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN,
    };
  } else if (type === "guest") {
    options = {
      expiresIn: 60 * parseInt(process.env.GUEST_TOKEN_EXPIRES_IN),
    };
  } else if (type === "guest-web") {
    options = {
      expiresIn: process.env.WEB_GUEST_TOKEN_EXPIRES_IN,
    };
  } else {
    options = {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN,
    };
  }
  options["issuer"] = process.env.AUTH_ISSUER;
  return options;
}

module.exports.verifyToken = async (token, type) => {
  const options = getOptions(type);
  let validate = jwt.verify(
    token,
    process.env.ACCESS_TOKEN_SIGNATURE_KEY,
    options
  );
  return validate;
};

module.exports.generatePolicy = function (
  principalId,
  effect,
  resource,
  context
) {
  let authResponse = {};
  authResponse.principalId = principalId;
  if (effect && resource) {
    const policyDocument = {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    };
    authResponse.policyDocument = policyDocument;
  }

  authResponse.context = context;

  return authResponse;
};
