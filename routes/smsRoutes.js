const express = require('express');
const router = express.Router();
const { sendSms } = require('../controllers/smsController');
const { auth } = require('../middleware/auth');

router.post('/api/send-sms', auth, sendSms);

module.exports = router;
