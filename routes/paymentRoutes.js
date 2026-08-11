const express = require('express');
const router = express.Router();
const { payPage, upiConfig } = require('../controllers/paymentController');

router.get('/pay/:billNo', payPage);
router.get('/api/upi-config', upiConfig);

module.exports = router;
