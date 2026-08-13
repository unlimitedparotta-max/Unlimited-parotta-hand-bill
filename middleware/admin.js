/* Express middleware: must be used AFTER auth() so req.role is set.
   Restricts a route to the admin role only. */
function adminOnly(req, res, next) {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

module.exports = { adminOnly };
