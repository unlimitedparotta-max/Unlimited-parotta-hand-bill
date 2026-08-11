const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');

// Not implemented yet (Step 7 — Today's/Weekly/Monthly Revenue, WhatsApp/SMS
// delivered counts, repeat customers, most sold item). The current admin
// Reports tab computes its numbers client-side from GET /api/orders
// (see routes/orderRoutes.js) — this route is reserved for the future
// dedicated analytics endpoint so the frontend won't need to change again.
router.get('/api/reports/summary', auth, adminOnly, (req, res) => {
  res.status(501).json({ error: 'Dedicated analytics endpoint isn\'t built yet — planned for a future step.' });
});

module.exports = router;
