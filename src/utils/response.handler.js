const HTTP_STATUS_CODES = {
  SUCCESS: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

const handleSuccess = (res, data = null, message = 'Success', statusCode = HTTP_STATUS_CODES.SUCCESS) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const handleError = (res, error, statusCode = HTTP_STATUS_CODES.BAD_REQUEST) => {
  console.error('Error:', error);
  
  // If error is a string, use it directly
  if (typeof error === 'string') {
    return res.status(statusCode).json({
      success: false,
      message: error
    });
  }

  // If error is an Error object with a message
  if (error instanceof Error) {
    return res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }

  // Default error response
  return res.status(statusCode).json({
    success: false,
    message: 'An error occurred'
  });
};

module.exports = {
  HTTP_STATUS_CODES,
  handleSuccess,
  handleError
}; 