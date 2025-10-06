"use strict";

const jwk = require("jsonwebtoken");
const jwkToPem = require("jwk-to-pem");
const request = require("request");

const iss =
  "https://cognito-idp.us-west-1.amazonaws.com/" + process.env.USER_POOL_ID;

// Generate policy to allow this user on this API:
const generatePolicy = (principalId, effect, resource) => {
  const authResponse = {};
  authResponse.principalId = principalId;
  if (effect && resource) {
    const policyDocument = {};
    policyDocument.Version = "2012-10-17";
    policyDocument.Statement = [];
    const statementOne = {};
    statementOne.Action = "execute-api:Invoke";
    statementOne.Effect = effect;
    statementOne.Resource = resource;
    policyDocument.Statement[0] = statementOne;
    authResponse.policyDocument = policyDocument;
  }
  return authResponse;
};

// Reusable Authorizer function, set on `authorizer` field in serverless.yml
module.exports.authorize = (event, context, cb) => {
  console.log("Auth function invoked");
  const authorizationToken = event?.headers?.Authorization;
  if (authorizationToken) {
    // Remove 'bearer ' from token:
    const token = authorizationToken.substring(7);
    // Make a request to the iss + .well-known/jwks.json URL:
    request(
      { url: `${iss}/.well-known/jwks.json`, json: true },
      (error, response, body) => {
        if (error || response.statusCode !== 200) {
          console.log("Request error:", error);
          cb("Unauthorized");
        }
        let pems = {};
        const keys = body["keys"];
        keys.forEach((key) => {
          const keyId = key.kid;
          const modulus = key.n;
          const exponent = key.e;
          const keyType = key.kty;
          const jwk = { kty: keyType, n: modulus, e: exponent };
          const pem = jwkToPem(jwk);
          pems[keyId] = pem;
        });
        const decodedJwt = jwk.decode(token, { complete: true });
        console.log("decodedJwt", decodedJwt);
        if (!decodedJwt) {
          cb("Not a valid JWT token");
        }
        console.log("pems", pems);
        const kid = decodedJwt["header"].kid;
        console.log("kid", kid);
        const pem = pems[kid];
        console.log("pem", pem);
        if (!pem) {
          cb("Invalid token");
        }
        // Verify the token:
        jwk.verify(token, pem, { issuer: iss }, (err, decoded) => {
          if (err) {
            console.log("Unauthorized user:", err.message);
            cb("Unauthorized");
          } else {
            console.log("event.methodArn", event.methodArn);
            cb(null, generatePolicy(decoded.sub, "Allow", event.methodArn));
          }
        });
      }
    );
  } else {
    console.log("No authorizationToken found in the header.");
    cb("Unauthorized");
  }
};
