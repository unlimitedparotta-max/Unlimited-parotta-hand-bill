const path = require('path');
const multer = require('multer');
const { readDb, writeDb, resolveCartItems, saveOrder, findOrderByCode } = require('../services/orderService');
const { generateBillPdfBuffer } = require('../services/pdfService');
const { renderBillHtml } = require('../services/billService');
const { buildUpiRawLink } = require('../utils/upi');
const { cleanMobile, isValidMobile } = require('../utils/mobileFormatter');
const { hashPin } = require('../middleware/auth');
const { ALLOWED_IMAGE_EXT } = require('../utils/constants');
const { getMenus, saveMenus } = require('../services/menuService');
const { uploadFile } = require('../services/supabaseService');

async function getState(req, res) {
  try {
    const db = readDb();

    let menus = await getMenus();

    if (!menus) {
      menus = db.menus;
      await saveMenus(menus);
    }

    res.json({
      role: req.role,
      menus,
      billCounter: db.billCounter,
      users: req.role === 'admin' ? db.users : undefined
    });
  } catch (e) {
    console.error('getState error:', e);

    res.status(500).json({
      error: e.message || 'Could not load application state'
    });
  }
}

function getOrders(req, res) {
  const db = readDb();
  let orders = db.orders;
  if (req.query.menuKey) orders = orders.filter(o => o.menuKey === req.query.menuKey);
  if (req.query.afterBillNo) orders = orders.filter(o => o.billNo > Number(req.query.afterBillNo));
  if (req.query.limit) orders = orders.slice(-Number(req.query.limit));
  res.json({ orders });
}

function createOrder(req, res) {
  const { menuKey, items, note, customerMobile, customerName, paymentMethod } = req.body || {};
  let mobile = '';
  if (customerMobile) {
    mobile = cleanMobile(customerMobile);
    if (!isValidMobile(mobile)) return res.status(400).json({ error: 'Enter a valid mobile number' });
  }
  const cleanName = String(customerName || '').trim().slice(0, 80);

  let resolvedItems;
  try {
    const db = readDb();
    resolvedItems = resolveCartItems(db, menuKey, items);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const order = saveOrder({
    menuKey, resolvedItems, note, cleanName, cleanMobile: mobile,
    role: req.role,
    paymentMethod: paymentMethod === 'gpay' ? 'gpay' : 'cash'
  });
  // upiLink is response-only (not persisted) so it always reflects the
  // current UPI_ID rather than going stale in stored order history.
  res.json({ ok: true, order: { ...order, upiLink: buildUpiRawLink(order) } });
}

function updateMenu(req, res) {
  const db = readDb();
  db.menus = req.body.menus;
  writeDb(db);
  res.json({ ok: true });
}

function updateUserPins(req, res) {
  const db = readDb();
  Object.keys(req.body || {}).forEach(role => {
    if (db.users[role] && req.body[role]) db.users[role].pin = hashPin(String(req.body[role]));
  });
  writeDb(db);
  res.json({ ok: true });
}

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_IMAGE_EXT.has(ext) || !/^image\//.test(file.mimetype || '')) {
      return cb(new Error('Only image files (jpg, png, webp, gif) are allowed'));
    }
    cb(null, true);
  }
});
function uploadMenuImage(req, res) {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received' });
    const ext = (path.extname(req.file.originalname) || '.jpg').toLowerCase();
    const finalName = req.file.filename + ext;
    fs.renameSync(req.file.path, path.join(UPLOAD_DIR, finalName));
    res.json({ ok: true, url: '/uploads/' + finalName });
  });
}

/* ---- Digital bill page + PDF (customer-facing, no login required) ---- */
function viewBill(req, res) {
  const db = readDb();
  const order = findOrderByCode(db, req.params.code);
  if (!order) return res.status(404).send('<h2 style="font-family:sans-serif;text-align:center;padding:60px 20px;">Bill not found.</h2>');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.send(renderBillHtml(order, baseUrl));
}

async function downloadBillPdf(req, res) {
  const db = readDb();
  const order = findOrderByCode(db, req.params.code);
  if (!order) return res.status(404).send('Bill not found.');
  try {
    const buffer = await generateBillPdfBuffer(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="bill-${order.billCode || order.billNo}.pdf"`);
    res.send(buffer);
  } catch (e) {
    res.status(500).send('Could not generate PDF: ' + e.message);
  }
}

module.exports = {
  getState, getOrders, createOrder, updateMenu, updateUserPins, uploadMenuImage,
  viewBill, downloadBillPdf
};
