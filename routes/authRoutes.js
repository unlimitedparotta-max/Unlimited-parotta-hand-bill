const express = require('express');
const router = express.Router();
const { login, logout } = require('../controllers/authController');
const { auth } = require('../middleware/auth');

router.post('/login', login);
router.post('/logout', auth, logout);

module.exports = router;
