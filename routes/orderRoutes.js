const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/orderController');
const { auth } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');
const { readDb, writeDb } = require('../services/orderService');

router.get('/api/state', auth, ctrl.getState);
router.get('/api/orders', auth, ctrl.getOrders);
router.post('/api/orders', auth, ctrl.createOrder);

// Rhythm Bar order workflow:
// NEW -> ACCEPTED -> PREPARING -> READY -> COMPLETED
// Staff/Admin advance kitchen status; Rhythm Bar can only mark READY as COMPLETED.
const ORDER_STATUSES = new Set(['new', 'accepted', 'preparing', 'ready', 'completed']);
const NEXT_STATUS = {
  new: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'completed'
};

router.put('/api/orders/:billNo/status', auth, (req, res) => {
  try {
    const billNo = Number(req.params.billNo);
    const status = String(req.body && req.body.status || '').toLowerCase();

    if (!Number.isInteger(billNo)) {
      return res.status(400).json({ error: 'Invalid bill number' });
    }
    if (!ORDER_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Invalid order status' });
    }

    const db = readDb();
    const order = db.orders.find(o => o.billNo === billNo);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.menuKey !== 'bar') {
      return res.status(400).json({ error: 'Only Rhythm Bar orders use this workflow' });
    }

    const current = order.status || 'new';
    const isStaffSide = req.role === 'staff' || req.role === 'admin';
    const isBarSide = req.role === 'bar';

    if (isStaffSide) {
      if (status !== NEXT_STATUS[current]) {
        return res.status(409).json({
          error: `Order is ${current}. Next status must be ${NEXT_STATUS[current] || 'completed'}.`
        });
      }
    } else if (isBarSide) {
      if (!(current === 'ready' && status === 'completed')) {
        return res.status(403).json({
          error: 'Rhythm Bar can mark an order completed only after it is READY.'
        });
      }
    } else {
      return res.status(403).json({ error: 'You cannot update order status' });
    }

    order.status = status;
    order.statusUpdatedAt = new Date().toISOString();
    order.statusUpdatedBy = db.users[req.role] ? db.users[req.role].label : req.role;
    writeDb(db);

    return res.json({ ok: true, order });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Could not update order status' });
  }
});
router.put('/api/menu', auth, adminOnly, ctrl.updateMenu);
router.put('/api/users/pins', auth, adminOnly, ctrl.updateUserPins);
router.post('/api/upload', auth, adminOnly, ctrl.uploadMenuImage);

// Digital bill page + PDF — customer-facing, no login required.
router.get('/bill/:code', ctrl.viewBill);
router.get('/bill/:code/pdf', ctrl.downloadBillPdf);

module.exports = router;
