/**
 * Wraps an async route handler so any thrown/rejected error
 * is automatically forwarded to Express's error-handling middleware
 * via next(). Eliminates the need for try/catch in every controller.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
