module.exports = (executor) => async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const response = await executor(event, context);
  if (!response) {
    return null;
  }
  const headers = response.headers || {};
  console.log(
    "The body from the input is ",
    response.body,
    " type is ",
    typeof response.body
  );
  return {
    statusCode: response.status,
    headers: {
      "Access-Control-Allow-Origin": "https://two4hr-new-ui.onrender.com",
      "Access-Control-Allow-Credentials": true,
      "Access-Control-Expose-Headers": "https://two4hr-new-ui.onrender.com",
      ...headers,
    },
   body: typeof response.body === "object" ? JSON.stringify(response.body, null, 2) : response.body
  };
};
