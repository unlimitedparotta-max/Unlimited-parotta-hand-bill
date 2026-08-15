const express = require('express');

const router = express.Router();

const {
  getIngredients,
  getAllIngredients,
  addIngredient,
  updateIngredient,
  deleteIngredient,
  restoreIngredient
} = require('../controllers/inventoryController');

const { auth } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');

/* GET ACTIVE INVENTORY */
router.get(
  '/api/inventory',
  auth,
  getIngredients
);

/* GET ALL INVENTORY */
router.get(
  '/api/inventory/all',
  auth,
  adminOnly,
  getAllIngredients
);

/* ADD INVENTORY ITEM */
router.post(
  '/api/inventory',
  auth,
  adminOnly,
  addIngredient
);

/* UPDATE INVENTORY ITEM */
router.put(
  '/api/inventory/:id',
  auth,
  adminOnly,
  updateIngredient
);

/* DELETE INVENTORY ITEM */
router.delete(
  '/api/inventory/:id',
  auth,
  adminOnly,
  deleteIngredient
);

/* RESTORE INVENTORY ITEM */
router.post(
  '/api/inventory/:id/restore',
  auth,
  adminOnly,
  restoreIngredient
);

module.exports = router;
