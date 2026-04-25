/**
 * Custom error class that carries an HTTP status code.
 * Throw this in any controller/middleware and the error handler
 * will use the statusCode to send the correct response.
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export default ApiError;
