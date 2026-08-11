const express = require('express');
const router = express.Router();
const { getCustomerHistory } = require('../controllers/customerController');
const { auth } = require('../middleware/auth');

// Not implemented yet (Step 8).
router.get('/api/customers/:mobile', auth, getCustomerHistory);

module.exports = router;
