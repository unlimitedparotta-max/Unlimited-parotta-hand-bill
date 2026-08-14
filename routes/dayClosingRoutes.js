const express = require('express');

const router = express.Router();

const {
  getTodaySummary,
  getClosing,
  closeDay,
  getHistory
} = require('../controllers/dayClosingController');

const { auth } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');

router.get(
  '/api/day-closing/summary',
  auth,
  adminOnly,
  getTodaySummary
);

router.get(
  '/api/day-closing',
  auth,
  adminOnly,
  getClosing
);

router.post(
  '/api/day-closing/close',
  auth,
  adminOnly,
  closeDay
);

router.get(
  '/api/day-closing/history',
  auth,
  adminOnly,
  getHistory
);

module.exports = router;
