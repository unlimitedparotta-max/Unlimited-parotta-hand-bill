const logger = require('../utils/logger');

/* Centralized Express error handler — a safety net for anything an async
   route handler throws without its own try/catch. Existing routes mostly
   handle their own errors inline (kept as-is, see CODING RULES: don't
   rewrite working code) — this just stops an uncaught error from ever
   crashing the process or leaking a raw stack trace to the client. */
function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.originalUrl} — ${err && err.stack ? err.stack : err}`);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

module.exports = { errorHandler };
