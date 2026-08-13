const fs = require('fs');
const { DATA_DIR, DB_PATH, UPLOAD_DIR } = require('../utils/constants');
const { hashPin } = require('../middleware/auth');
const { generateBillCode } = require('../utils/billCode');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------------- seed data (default menu + admin/staff/bar logins) ---------------- */
function seedDb() {
  return {
    users: {
      admin: { label: 'Admin', pin: hashPin('admin123') },
      staff: { label: 'Unlimited Staff', pin: hashPin('staff123') },
      bar: { label: 'Rhythm Bar', pin: hashPin('bar123') }
    },
    menus: {
      unlimited: [
        { cat: 'Parotta', items: [
          { id: 'p1', name: 'Unlimited Parotta', price: 99, image: null },
          { id: 'p2', name: 'Nool Parotta', price: 30, image: null },
          { id: 'p3', name: 'Bun Parotta', price: 30, image: null },
          { id: 'p4', name: 'Poricha Parotta', price: 30, image: null },
          { id: 'p5', name: 'Coin Parotta (4pc)', price: 50, image: null },
          { id: 'p6', name: 'Plain Parotta', price: 20, image: null }
        ]},
        { cat: 'Kuruma (Free)', items: [
          { id: 'k1', name: 'Veg Kuruma', price: 0, image: null },
          { id: 'k2', name: 'Chicken Kuruma', price: 0, image: null },
          { id: 'k3', name: 'Mutton Kuruma', price: 0, image: null }
        ]},
        { cat: 'Egg & Sides', items: [
          { id: 'e1', name: 'Omelette', price: 30, image: null },
          { id: 'e2', name: 'Kuruma Kalakki', price: 25, image: null },
          { id: 'e3', name: 'Normal Kalakki', price: 20, image: null },
          { id: 'e4', name: 'Full Boil', price: 20, image: null },
          { id: 'e5', name: 'Half Boil', price: 20, image: null }
        ]}
      ],
      bar: [
        { cat: 'Sea Food Starters', items: [
          { id: 'b1', name: 'Fish 65', price: 119, image: null },
          { id: 'b2', name: 'Fish Finger', price: 129, image: null },
          { id: 'b3', name: 'Prawn Golden Fry', price: 139, image: null },
          { id: 'b4', name: 'Crispy Prawn', price: 140, image: null },
          { id: 'b5', name: 'Prawn Salt & Pepper', price: 149, image: null },
          { id: 'b6', name: 'Crab Lollipop', price: 149, image: null },
          { id: 'b7', name: 'Squid Fry', price: 139, image: null },
          { id: 'b8', name: 'Squid Varuval', price: 149, image: null }
        ]},
        { cat: 'Chicken Starters', items: [
          { id: 'b9', name: 'Crispy Fried Chicken', price: 109, image: null },
          { id: 'b10', name: 'Chilli Chicken', price: 99, image: null },
          { id: 'b11', name: 'Garlic Chicken', price: 119, image: null },
          { id: 'b12', name: 'Ginger Chicken', price: 129, image: null },
          { id: 'b13', name: 'Honey Chicken', price: 129, image: null },
          { id: 'b14', name: 'Chicken Lollipop', price: 109, image: null },
          { id: 'b15', name: 'Chicken 65', price: 99, image: null },
          { id: 'b16', name: 'Saute Chicken', price: 109, image: null },
          { id: 'b17', name: 'Chicken Nuggets', price: 99, image: null },
          { id: 'b18', name: 'Kaadai Fry', price: 129, image: null },
          { id: 'b19', name: 'Pepper Kaadai', price: 139, image: null }
        ]},
        { cat: 'Egg Starters', items: [
          { id: 'b20', name: 'Omelette', price: 59, image: null },
          { id: 'b21', name: 'Full Boil', price: 49, image: null },
          { id: 'b22', name: 'Kalakki', price: 59, image: null },
          { id: 'b23', name: 'Gurumaa Kalakki', price: 79, image: null },
          { id: 'b24', name: 'Chicken Kalakki', price: 99, image: null },
          { id: 'b25', name: 'Chilli Egg', price: 129, image: null },
          { id: 'b26', name: 'Karandi Omlette', price: 60, image: null }
        ]},
        { cat: 'Veg Starters', items: [
          { id: 'b27', name: 'Babycorn Salt & Pepper', price: 89, image: null },
          { id: 'b28', name: 'Chilli Babycorn', price: 89, image: null },
          { id: 'b29', name: '65 Mushroom', price: 79, image: null },
          { id: 'b30', name: 'Salt & Pepper Mushroom', price: 89, image: null },
          { id: 'b31', name: 'Gobi 65', price: 69, image: null },
          { id: 'b32', name: 'Gobi Manchurian', price: 79, image: null },
          { id: 'b33', name: 'Masala Pappad', price: 49, image: null },
          { id: 'b34', name: 'Peanut Pappad', price: 69, image: null },
          { id: 'b35', name: 'Crispy Corn', price: 79, image: null },
          { id: 'b36', name: 'French Fries', price: 59, image: null }
        ]}
      ]
    },
    orders: [],
    billCounter: 1
  };
}

/* ---------------- simple JSON-file "db" with a write queue ---------------- */
function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(seedDb(), null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
let writeQueue = Promise.resolve();
function writeDb(db) {
  writeQueue = writeQueue.then(() => fs.promises.writeFile(DB_PATH, JSON.stringify(db, null, 2)));
  return writeQueue;
}

/* Validates and prices a cart against the current menu — never trusts
   prices sent from the client, always looks them up server-side. */
function resolveCartItems(db, menuKey, items) {
  const menuCats = db.menus[menuKey];
  if (!menuCats) throw new Error('Invalid menu');
  if (!items || !items.length) throw new Error('No items in order');
  const catalog = new Map();
  menuCats.forEach(c => c.items.forEach(it => catalog.set(it.id, it)));
  const resolvedItems = [];
  for (const raw of items) {
    const master = catalog.get(raw && raw.id);
    if (!master) throw new Error(`Unknown item in order${raw && raw.name ? ': ' + raw.name : ''}`);
    const qty = Number(raw.qty);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 999) throw new Error(`Invalid quantity for ${master.name}`);
    resolvedItems.push({ id: master.id, name: master.name, price: master.price, qty });
  }
  return resolvedItems;
}

/* Saves a new order: assigns billNo + a secure billCode, computes the
   total, and persists it. */
function saveOrder({ menuKey, resolvedItems, note, cleanName, cleanMobile, role, paymentMethod, paymentId }) {
  const db = readDb();
  const billNo = db.billCounter++;
  const now = new Date();
  let billCode = generateBillCode(now);
  // Practically impossible, but cheap to guard against a random-suffix collision.
  while (db.orders.some(o => o.billCode === billCode)) billCode = generateBillCode(now);
  const order = {
    billNo,
    billCode,
    menuKey,
    note: String(note || '').slice(0, 300),
    customerName: cleanName,
    customerMobile: cleanMobile,
    items: resolvedItems,
    total: resolvedItems.reduce((s, i) => s + i.price * i.qty, 0),
    time: now.toISOString(),
    servedBy: db.users[role] ? db.users[role].label : role,
    paymentMethod: paymentMethod || 'cash',
    paymentId: paymentId || null,
    delivery: { whatsapp: 'not_sent', sms: 'not_sent' } // filled in as delivery attempts happen (see notificationService)
  };
  db.orders.push(order);
  writeDb(db);
  return order;
}

/* billCode is the normal lookup path; billNo fallback covers orders saved
   before the bill-link feature existed (they won't have a billCode). */
function findOrderByCode(db, code) {
  return db.orders.find(o => o.billCode === code) ||
    db.orders.find(o => String(o.billNo) === String(code));
}

/* Records a delivery attempt's outcome on the order (Step 5: delivery
   status tracking) — safe to call even though nothing reads this yet. */
function recordDeliveryStatus(billCode, channel, status) {
  const db = readDb();
  const order = findOrderByCode(db, billCode);
  if (!order) return;
  order.delivery = order.delivery || {};
  order.delivery[channel] = status;
  order.delivery.lastUpdated = new Date().toISOString();
  writeDb(db);
}

module.exports = {
  seedDb, readDb, writeDb, resolveCartItems, saveOrder, findOrderByCode, recordDeliveryStatus
};
