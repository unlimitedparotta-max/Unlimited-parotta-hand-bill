const { isValidMobile } = require('../utils/mobileFormatter');

/* Small reusable request-validation helpers. Each returns an Express
   middleware; on failure they respond directly and never call next(). */
function requireMobile(field = 'mobile') {
  return (req, res, next) => {
    const value = req.body && req.body[field];
    if (!isValidMobile(value)) return res.status(400).json({ error: 'Enter a valid mobile number' });
    next();
  };
}
function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter(f => req.body == null || req.body[f] === undefined || req.body[f] === '');
    if (missing.length) return res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` });
    next();
  };
}

module.exports = { requireMobile, requireFields };
