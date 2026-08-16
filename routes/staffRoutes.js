const express = require('express');

const {
  getStaff,
  getTodayStaff,
  markAttendance,
  saveDailySalary,
  markSalaryPaid,
  addStaff,
  updateStaff,
  deleteStaff
} = require('../controllers/staffController');

const router = express.Router();


// Get all staff
router.get('/', getStaff);


// Get today's attendance + salary
router.get('/today', getTodayStaff);

// Add staff
router.post('/', addStaff);

// Update staff
router.put('/:id', updateStaff);

// Deactivate staff
router.delete('/:id', deleteStaff);

// Mark attendance
router.post('/attendance', markAttendance);


// Save daily salary
router.post('/salary', saveDailySalary);


// Mark salary as paid
router.patch('/salary/:id/paid', markSalaryPaid);


module.exports = router;
