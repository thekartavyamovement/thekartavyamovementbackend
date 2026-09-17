'use strict';

/**
 * Centralised Express error handler.
 * Must be registered LAST (after all routes) in server.js.
 */
function errorHandler(err, req, res, _next) {
  // CORS errors bubbled from the cors() middleware
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ success: false, message: err.message });
  }

  // Payload too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request payload too large.' });
  }

  // Malformed JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body.' });
  }

  // Log unexpected errors (don't expose stack trace to client)
  console.error('[ERROR]', err.stack || err.message);

  return res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred. Please try again later.'
        : err.message || 'Internal server error.',
  });
}

module.exports = { errorHandler };
