// Wraps an async Express handler so rejected promises reach the error
// middleware. Without this, every route would need its own try/catch.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
