module.exports =
  (executor, middlewares = []) =>
  async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    // Create a middleware chain
    const middlewareChain = async (event, context) => {
      let shouldContinue = true;

      // Execute all middlewares in sequence
      for (const middleware of middlewares) {
        const result = await middleware(event, context);
        if (result === false || (result && result.statusCode)) {
          shouldContinue = false;
          // Return middleware error response if exists
          if (result && result.statusCode) {
            return formatResponse(result);
          }
          break;
        }
      }

      if (shouldContinue) {
        return await executor(event, context);
      }

      return formatResponse({
        statusCode: 403,
        body: { message: "Authorization failed" },
      });
    };

    try {
      const response = await middlewareChain(event, context);
      return formatResponse(response);
    } catch (error) {
      console.error("Handler error:", error);
      return formatResponse({
        statusCode: error.statusCode || 500,
        body: { message: error.message || "Internal server error" },
      });
    }
  };

// Helper function to format consistent responses
function formatResponse(response) {
  const headers = response?.headers || {};
  return {
    statusCode: response.statusCode || 200,
    headers: {
      "Access-Control-Allow-Origin": "https://two4hr-new-ui.onrender.com",
      "Access-Control-Allow-Credentials": true,
      "Access-Control-Expose-Headers": "https://two4hr-new-ui.onrender.com",
      ...headers,
    },
    body: JSON.stringify(response.body || response, null, 2),
  };
}
