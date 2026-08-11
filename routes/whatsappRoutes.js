const express = require('express');
const router = express.Router();
const { sendWhatsAppBill } = require('../controllers/whatsappController');
const { auth } = require('../middleware/auth');

router.post('/api/send-whatsapp-bill', auth, sendWhatsAppBill);

module.exports = router;
