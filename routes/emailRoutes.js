const express = require('express');
const router = express.Router();
const { sendEmailBill } = require('../controllers/emailController');
const { auth } = require('../middleware/auth');

// Not implemented yet (Step 9) — returns 501 so the frontend can already
// wire this up and get an honest "not ready" response instead of a 404.
router.post('/api/send-email-bill', auth, sendEmailBill);

module.exports = router;
