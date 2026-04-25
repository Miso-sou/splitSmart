/**
 * Central error-handling middleware.
 * Express recognizes this as an error handler because it has 4 parameters (err, req, res, next).
 * Any error thrown in a controller wrapped with asyncHandler lands here.
 */
const errorHandler = (err, req, res, next) => {
  // If statusCode was set (via ApiError), use it; otherwise default to 500
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Log the error in development for debugging
  if (process.env.NODE_ENV !== "production") {
    console.error(`[ERROR] ${statusCode} - ${message}`);
    if (statusCode === 500) console.error(err.stack);
  }

  res.status(statusCode).json({
    message,
    // Only include stack trace in development
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

export default errorHandler;
