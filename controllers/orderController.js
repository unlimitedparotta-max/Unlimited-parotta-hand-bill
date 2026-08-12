const multer = require('multer');
const path = require('path');

const {
  readDb,
  writeDb,
  resolveCartItems,
  saveOrder,
  findOrderByCode
} = require('../services/orderService');

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

  if (req.query.menuKey) {
    orders = orders.filter(o => o.menuKey === req.query.menuKey);
  }

  if (req.query.afterBillNo) {
    orders = orders.filter(
      o => o.billNo > Number(req.query.afterBillNo)
    );
  }

  if (req.query.limit) {
    orders = orders.slice(-Number(req.query.limit));
  }

  res.json({ orders });
}

async function createOrder(req, res) {
  const {
    menuKey,
    items,
    note,
    customerMobile,
    customerName,
    paymentMethod
  } = req.body || {};

  let mobile = '';

  if (customerMobile) {
    mobile = cleanMobile(customerMobile);

    if (!isValidMobile(mobile)) {
      return res.status(400).json({
        error: 'Enter a valid mobile number'
      });
    }
  }

  const cleanName = String(customerName || '')
    .trim()
    .slice(0, 80);

  let resolvedItems;

  try {
    // IMPORTANT:
    // Always read the latest menu from Supabase.
    const menus = await getMenus();

    if (!menus || !menus[menuKey]) {
      return res.status(400).json({
        error: 'Menu not available'
      });
    }

    // Use the current Supabase menu to resolve
    // item names and prices.
    const db = {
      menus
    };

    resolvedItems = resolveCartItems(
      db,
      menuKey,
      items
    );

  } catch (e) {
    console.error('createOrder menu error:', e);

    return res.status(400).json({
      error: e.message || 'Could not load current menu'
    });
  }

  const order = saveOrder({
    menuKey,
    resolvedItems,
    note,
    cleanName,
    cleanMobile: mobile,
    role: req.role,
    paymentMethod:
      paymentMethod === 'gpay'
        ? 'gpay'
        : 'cash'
  });

  res.json({
    ok: true,
    order: {
      ...order,
      upiLink: buildUpiRawLink(order)
    }
  });
}
async function updateMenu(req, res) {
  try {
    const menus = req.body.menus;

    if (!menus || typeof menus !== 'object') {
      return res.status(400).json({ error: 'Invalid menu data' });
    }

    // Save permanently to Supabase
    await saveMenus(menus);

    // Keep local DB synchronized as a fallback
    const db = readDb();
    db.menus = menus;
    await writeDb(db);

    res.json({
      ok: true,
      menus
    });

  } catch (e) {
    console.error('updateMenu error:', e);

    res.status(500).json({
      error: e.message || 'Could not save menu'
    });
  }
}

function updateUserPins(req, res) {
  const db = readDb();

  Object.keys(req.body || {}).forEach(role => {
    if (
      db.users[role] &&
      req.body[role]
    ) {
      db.users[role].pin = hashPin(
        String(req.body[role])
      );
    }
  });

  writeDb(db);

  res.json({
    ok: true
  });
}


/* =========================================================
   MENU IMAGE UPLOAD
   Uses Supabase Storage instead of Vercel local filesystem.
   ========================================================= */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024
  },

  fileFilter: (req, file, cb) => {
    const ext = path
      .extname(file.originalname || '')
      .toLowerCase();

    if (
      !ALLOWED_IMAGE_EXT.has(ext) ||
      !/^image\//.test(file.mimetype || '')
    ) {
      return cb(
        new Error(
          'Only image files (jpg, png, webp, gif) are allowed'
        )
      );
    }

    cb(null, true);
  }
});

function uploadMenuImage(req, res) {
  upload.single('image')(
    req,
    res,
    async (err) => {
      if (err) {
        return res.status(400).json({
          error: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No file received'
        });
      }

      try {
        const ext = path
          .extname(req.file.originalname || '.jpg')
          .toLowerCase();

        const fileName =
          `menu/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 10)}${ext}`;

        const bucket =
          process.env.SUPABASE_BUCKET ||
          'dish-images';

        const publicUrl = await uploadFile(
          bucket,
          fileName,
          req.file.buffer,
          req.file.mimetype
        );

        res.json({
          ok: true,
          url: publicUrl
        });

      } catch (e) {
        console.error(
          'Menu image upload error:',
          e
        );

        res.status(500).json({
          error:
            e.message ||
            'Could not upload image'
        });
      }
    }
  );
}


/* =========================================================
   DIGITAL BILL PAGE
   ========================================================= */

function viewBill(req, res) {
  const db = readDb();

  const order = findOrderByCode(
    db,
    req.params.code
  );

  if (!order) {
    return res
      .status(404)
      .send(
        '<h2 style="font-family:sans-serif;text-align:center;padding:60px 20px;">Bill not found.</h2>'
      );
  }

  const baseUrl =
    `${req.protocol}://${req.get('host')}`;

  res.send(
    renderBillHtml(
      order,
      baseUrl
    )
  );
}


/* =========================================================
   BILL PDF
   ========================================================= */

async function downloadBillPdf(req, res) {
  const db = readDb();

  const order = findOrderByCode(
    db,
    req.params.code
  );

  if (!order) {
    return res
      .status(404)
      .send('Bill not found.');
  }

  try {
    const buffer =
      await generateBillPdfBuffer(order);

    res.setHeader(
      'Content-Type',
      'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      `inline; filename="bill-${order.billCode || order.billNo}.pdf"`
    );

    res.send(buffer);

  } catch (e) {
    console.error(
      'Bill PDF error:',
      e
    );

    res
      .status(500)
      .send(
        'Could not generate PDF: ' +
        e.message
      );
  }
}


module.exports = {
  getState,
  getOrders,
  createOrder,
  updateMenu,
  updateUserPins,
  uploadMenuImage,
  viewBill,
  downloadBillPdf
};
