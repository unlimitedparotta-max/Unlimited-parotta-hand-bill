/* ================= SESSION / STATE ================= */
let TOKEN = localStorage.getItem('up_token') || null;
let ROLE = localStorage.getItem('up_role') || null;
let LABEL = localStorage.getItem('up_label') || '';
let STATE = { menus: { unlimited: [], bar: [] }, billCounter: 1, users: null };
let CART = [];
let CART_DRAWER_OPEN = false;

const PRINTED_KEY = 'up_printed_billnos';
const AUTOPRINT_KEY = 'up_autoprint';
let PRINTED_BILLNOS = new Set(JSON.parse(localStorage.getItem(PRINTED_KEY) || '[]'));
let AUTO_PRINT = localStorage.getItem(AUTOPRINT_KEY) !== 'off';
let PENDING_BAR_ORDERS = [];
let BAR_ORDERS = [];
let BAR_STATUS_SNAPSHOT = new Map();
let POLL_TIMER = null;

let ADMIN_TAB = 'billing';
let ADMIN_BILL_COUNTER = 'unlimited';

/* Edit these once — they're reused on every printed receipt, the overall
   bill, and the SMS message so everything looks consistent. */
const SHOP_INFO = {
  name: 'UNLIMITED PAROTTA',
  tagline: 'Taste Unlimited. Happiness Unlimited.',
  addressLines: [
    '14, Rani Paradise Theater Complex,',
    'Membalam Rd, Pandiyar Residency,',
    'Thanjavur, India, 613007'
  ],
  phone: '97895 22232',
  hoursLines: ['12.00 PM to 4.00 PM', '7.00 PM to 10.00 PM'],
  // Google review / feedback link, e.g. your Google Business "Write a review"
  // link. Leave blank to show a plain star prompt with no link.
  reviewLink: ''
};
// Single-line address, kept for places (WhatsApp/SMS text) that want one line.
SHOP_INFO.address = SHOP_INFO.addressLines.join(' ');

/* ---- Monospace receipt formatting helpers ----
   Real thermal printers render whatever text stream the browser sends —
   flexbox/div layouts often get ignored or squished by the printer driver.
   A fixed-width monospace block prints reliably and keeps columns aligned.
   RECEIPT_WIDTH=40 fits standard 80mm paper at normal font size; 32 fits
   58mm paper. Staff can toggle this from the billing screen — it's kept
   in localStorage so the choice sticks per till. */
const PAPERWIDTH_KEY = 'up_paperwidth';
let PAPER_WIDTH = localStorage.getItem(PAPERWIDTH_KEY) === '58' ? '58' : '80';
let RECEIPT_WIDTH = PAPER_WIDTH === '58' ? 32 : 40;
function setPaperWidth(w) {
  PAPER_WIDTH = w === '58' ? '58' : '80';
  localStorage.setItem(PAPERWIDTH_KEY, PAPER_WIDTH);
  RECEIPT_WIDTH = PAPER_WIDTH === '58' ? 32 : 40;
  applyThermalPageStyle();
}
// Updates the @page size + receipt container width to match the selected
// paper. Done via a <style> tag (not a static stylesheet rule) so it can
// change at runtime without a page reload.
function applyThermalPageStyle() {
  const tag = document.getElementById('thermal-page-style');
  if (!tag) return;
  const mm = PAPER_WIDTH === '58' ? 58 : 80;
  const contentMm = PAPER_WIDTH === '58' ? 50 : 72;
  tag.textContent = `@page{size:${mm}mm auto;margin:0;} @media print{#receipt-print{width:${mm}mm;} .receipt-mono{width:${contentMm}mm;font-size:${PAPER_WIDTH === '58' ? '11px' : '12px'};}}`;
}
applyThermalPageStyle();
function padR(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
function padL(s, n) { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }
function centerText(s, n) {
  s = String(s);
  if (s.length >= n) return s;
  const total = n - s.length, left = Math.floor(total / 2);
  return ' '.repeat(left) + s + ' '.repeat(total - left);
}
function receiptDivider() { return '-'.repeat(RECEIPT_WIDTH); }
function itemRow(name, qtyStr, amtStr) {
  const NAME_W = 20, QTY_W = 6, AMT_W = RECEIPT_WIDTH - NAME_W - QTY_W;
  if (String(name).length > NAME_W) {
    // Long names get their own line so qty/amount stay aligned for every row.
    return padR(name, RECEIPT_WIDTH) + '\n' + padL(qtyStr, NAME_W + QTY_W) + padL(amtStr, AMT_W);
  }
  return padR(name, NAME_W) + padL(qtyStr, QTY_W) + padL(amtStr, AMT_W);
}

/* ---- Bill-format helpers (match the printed sample bill) ---- */
function pad0(n, w = 2) { return String(n).padStart(w, '0'); }

/* Human bill code like "UPB2505180001" — prefix + YYMMDD + 4-digit running
   number. This is DISPLAY ONLY; the numeric order.billNo underneath is still
   what's used for print-tracking, reprint lookups, etc. */
function formatBillCode(order) {
  const d = new Date(order.time);
  const prefix = order.menuKey === 'bar' ? 'RB' : 'UPB';
  return `${prefix}${pad0(d.getFullYear() % 100)}${pad0(d.getMonth() + 1)}${pad0(d.getDate())}${pad0(order.billNo, 4)}`;
}
function billDateStr(iso) {
  const d = new Date(iso);
  return `${pad0(d.getDate())}-${pad0(d.getMonth() + 1)}-${d.getFullYear()}`;
}
function billTimeStr(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = pad0(d.getMinutes());
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${pad0(h)}:${m} ${ap}`;
}
// Compact "20 Jul 2026, 03:05 PM" — kept for printOverallBill and other
// single-line uses. The receipt itself now prints Date/Time as separate
// rows (see printReceipt) to match the approved layout.
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function billDateTimeStr(iso) {
  const d = new Date(iso);
  return `${pad0(d.getDate())} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}, ${billTimeStr(iso)}`;
}
// "10 Aug 2026" — date only, no time.
function billDateHuman(iso) {
  const d = new Date(iso);
  return `${pad0(d.getDate())} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Item row with S.No / Item Name / Qty / Rate / Amount columns, sized to
   fit RECEIPT_WIDTH=40. Long names wrap to their own line like itemRow(). */
function billItemRow(sno, name, qtyStr, rateStr, amtStr) {
  const SNO_W = 3, NAME_W = 14, QTY_W = 4, RATE_W = 9;
  const AMT_W = RECEIPT_WIDTH - SNO_W - NAME_W - QTY_W - RATE_W;
  const numsLine = padL(qtyStr, QTY_W) + padL(rateStr, RATE_W) + padL(amtStr, AMT_W);
  if (String(name).length > NAME_W) {
    return padR(String(sno), SNO_W) + padR(name, RECEIPT_WIDTH - SNO_W) + '\n' + ' '.repeat(SNO_W + NAME_W) + numsLine;
  }
  return padR(String(sno), SNO_W) + padR(name, NAME_W) + numsLine;
}

/* Indian-style number-to-words (Crore/Lakh/Thousand) for the "(Rupees ...
   Only)" line under the grand total. */
function numberToWordsIndian(num) {
  num = Math.round(Number(num) || 0);
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function twoDigits(n) { return n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''); }
  function threeDigits(n) {
    let s = '';
    if (n >= 100) { s += ones[Math.floor(n / 100)] + ' Hundred'; n %= 100; if (n) s += ' '; }
    if (n) s += twoDigits(n);
    return s;
  }
  if (num === 0) return 'Zero';
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  const rest = num;
  const parts = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(threeDigits(lakh) + ' Lakh');
  if (thousand) parts.push(threeDigits(thousand) + ' Thousand');
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}
function amountInWords(amount) { return `Rupees ${numberToWordsIndian(amount)} Only`; }

/* A normal https link to our own /pay/:billNo page (see server.js), which
   auto-redirects the customer into their UPI app. Using our own https link
   (instead of a raw "upi://" link) means it reliably becomes a tappable
   link inside SMS and WhatsApp on every phone. */
function buildPayLink(order) {
  return `${window.location.origin}/pay/${order.billNo}`;
}

/* ================= API HELPER ================= */
async function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (TOKEN) headers['X-Token'] = TOKEN;
  if (!(opts.body instanceof FormData) && opts.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { ...opts, headers });
  if (res.status === 401) {
    doLocalLogout();
    render();
    throw new Error('Session expired — please log in again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function markPrinted(billNo) {
  PRINTED_BILLNOS.add(billNo);
  localStorage.setItem(PRINTED_KEY, JSON.stringify(Array.from(PRINTED_BILLNOS).slice(-300)));
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.15;
    o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 220);
  } catch (e) {}
}
function rupee(n) { return '₹' + Number(n).toFixed(0); }
function todayStr(d) { const dt = d ? new Date(d) : new Date(); return dt.toISOString().slice(0, 10); }
function niceDateTime(iso) { const d = new Date(iso); return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function counterLabel(key) { return key === 'unlimited' ? 'Unlimited Parotta' : 'Rhythm Bar'; }
function showToast(msg) {
  const root = document.getElementById('modal-root');
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = msg;
  root.appendChild(div);
  setTimeout(() => div.remove(), 3200);
}

/* ================= BOOT / LOGIN ================= */
function doLocalLogout() {
  TOKEN = null; ROLE = null; LABEL = '';
  localStorage.removeItem('up_token'); localStorage.removeItem('up_role'); localStorage.removeItem('up_label');
  CART = []; CART_DRAWER_OPEN = false;
  if (POLL_TIMER) { clearInterval(POLL_TIMER); POLL_TIMER = null; }
}

async function logout() {
  try { await api('/api/logout', { method: 'POST' }); } catch (e) {}
  doLocalLogout();
  render();
}

async function boot() {
  if (TOKEN && ROLE) {
    try {
      await loadState();
      render();
      return;
    } catch (e) {
      doLocalLogout();
    }
  }
  render();
}

async function loadState() {
  const data = await api('/api/state');
  STATE.menus = data.menus;
  STATE.billCounter = data.billCounter;
  STATE.users = data.users || null;
}

function render() {
  const app = document.getElementById('app');
  if (!ROLE) { app.innerHTML = renderLogin(); attachLoginEvents(); return; }
  if (ROLE === 'admin') { app.innerHTML = renderAdminShell(); attachAdminEvents(); return; }
  const menuKey = ROLE === 'staff' ? 'unlimited' : 'bar';
  app.innerHTML = renderStaffShell(menuKey);
  attachStaffEvents(menuKey);
}

/* ================= LOGIN ================= */
function renderLogin() {
  return `
  <div class="login-wrap">
    <div class="login-card">
      <div class="brand-row">
        <h1>UNLIMITED PAROTTA</h1>
        <span class="brand-x">&times;</span>
        <h1 class="gold">RHYTHM BAR</h1>
      </div>
      <div class="tagline">Billing &amp; Counter System</div>
      <div class="role-grid">
        <div class="role-card admin">
          <span class="icon">🗝️</span>
          <h3>Admin</h3>
          <p>Full access — both counters, reports, menu &amp; staff settings</p>
          <input type="password" id="pin-admin" placeholder="PIN">
          <button class="btn" data-role="admin">Login as Admin</button>
        </div>
        <div class="role-card">
          <span class="icon">🫓</span>
          <h3>Unlimited Staff</h3>
          <p>Billing counter for the parotta &amp; egg menu (ground floor)</p>
          <input type="password" id="pin-staff" placeholder="PIN">
          <button class="btn" data-role="staff">Login as Staff</button>
        </div>
        <div class="role-card bar">
          <span class="icon">🍸</span>
          <h3>Rhythm Bar</h3>
          <p>Billing counter for the bar &amp; starters menu (1st floor)</p>
          <input type="password" id="pin-bar" placeholder="PIN">
          <button class="btn" data-role="bar">Login to Rhythm</button>
        </div>
      </div>
      <div class="login-err" id="login-err"></div>
    </div>
  </div>`;
}
function attachLoginEvents() {
  document.querySelectorAll('.role-card .btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const role = btn.dataset.role;
      const pin = document.getElementById('pin-' + role).value.trim();
      const err = document.getElementById('login-err');
      btn.textContent = 'Checking…';
      try {
        const data = await api('/api/login', { method: 'POST', body: JSON.stringify({ role, pin }) });
        TOKEN = data.token; ROLE = data.role; LABEL = data.label;
        localStorage.setItem('up_token', TOKEN);
        localStorage.setItem('up_role', ROLE);
        localStorage.setItem('up_label', LABEL);
        await loadState();
        CART = [];
        err.textContent = '';
        render();
      } catch (e) {
        err.textContent = e.message || 'Incorrect PIN.';
        btn.textContent = btn.dataset.role === 'admin' ? 'Login as Admin' : (btn.dataset.role === 'bar' ? 'Login to Rhythm' : 'Login as Staff');
      }
    });
  });
  document.querySelectorAll('.role-card input[type=password]').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { inp.nextElementSibling.click(); } });
  });
}

/* ================= STAFF BILLING SHELL ================= */
function renderStaffShell(menuKey) {
  const isBar = menuKey === 'bar';
  return `
  <div class="shell">
    <div class="topbar ${isBar ? 'bar' : ''}">
      <div class="who"><span class="dot"></span><h2>${counterLabel(menuKey)} — Billing</h2></div>
      <div class="topbar-actions">
        ${menuKey === 'unlimited' ? `<button class="sync-badge" id="bar-orders-btn">🔔 Bar orders${PENDING_BAR_ORDERS.length ? ` <span class="cnt">${PENDING_BAR_ORDERS.length}</span>` : ''}</button>` : ''}
        ${menuKey === 'bar' ? `<button class="sync-badge" id="bar-status-btn">🔔 Order status${BAR_ORDERS.filter(o => (o.status || 'new') === 'ready').length ? ` <span class="cnt">${BAR_ORDERS.filter(o => (o.status || 'new') === 'ready').length}</span>` : ''}</button>` : ''}
        <span class="pill-btn">${LABEL}</span>
        <button class="pill-btn logout" id="logout-btn">Log out</button>
      </div>
    </div>
    <div class="content">${renderBillingArea(menuKey)}</div>
  </div>`;
}

function renderBillingArea(menuKey) {
  const cats = STATE.menus[menuKey] || [];
  return `
  <div class="bill-layout">
    <div class="menu-col">
      ${cats.map(c => `
        <div class="cat-block">
          <h3>${c.cat}<span class="rule"></span></h3>
          <div class="item-grid">
            ${c.items.map(it => {
              const inCart = CART.find(x => x.id === it.id);
              const isFree = it.price === 0;
              return `<button class="item-btn ${isFree ? 'free' : ''}" data-id="${it.id}" data-menu="${menuKey}">
                ${inCart ? `<span class="qtybadge">${inCart.qty}</span>` : ''}
                ${it.image ? `<img class="thumb" src="${it.image}" alt="">` : `<span class="thumb-placeholder">🍽️</span>`}
                <span class="body">
                  <span class="nm">${it.name}</span>
                  <span class="pricerow"><span class="leader"></span><span class="pr">${isFree ? 'FREE' : rupee(it.price)}</span></span>
                </span>
              </button>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>
    <div class="cart ${CART_DRAWER_OPEN ? 'open' : ''}">
      <div class="cart-close-btn" id="cart-close-btn">Close ✕</div>
      <h3>Current Order</h3>
      <div id="cart-lines">${renderCartLines()}</div>
      <div class="cart-total"><span>Total</span><span id="cart-total-val">${rupee(cartTotal())}</span></div>
      <div class="paper-width-row">
        <span>🖨️ Receipt paper</span>
        <select id="paper-width-select">
          <option value="80" ${PAPER_WIDTH === '80' ? 'selected' : ''}>80mm</option>
          <option value="58" ${PAPER_WIDTH === '58' ? 'selected' : ''}>58mm</option>
        </select>
      </div>
      <div class="field">
        <label>Table / Token (optional)</label>
        <input type="text" id="order-note" placeholder="e.g. Table 4 / Parcel">
      </div>
      ${ROLE !== 'bar' ? `
      <div class="field">
        <label>Customer Name (optional)</label>
        <input type="text" id="customer-name" placeholder="e.g. Mr. Kavin Dharan">
      </div>
      <div class="field">
        <label>Customer Mobile Number (optional)</label>
        <input type="tel" id="customer-mobile" placeholder="e.g. 9876543210" inputmode="numeric">
      </div>` : ''}
      <button class="checkout-btn" id="checkout-btn" ${CART.length ? '' : 'disabled'}>${checkoutBtnLabel()}</button>
      <button class="clear-btn" id="clear-cart-btn">Clear order</button>
    </div>
  </div>
  <div class="mobile-cart-bar ${menuKey === 'bar' ? 'gold' : ''}" id="mobile-cart-bar">
    <span>🛒 ${CART.length} item${CART.length === 1 ? '' : 's'}<span class="mc-sub">Tap to view order</span></span>
    <span>${rupee(cartTotal())}</span>
  </div>`;
}

function checkoutBtnLabel() {
  if (ROLE === 'bar') return 'Send Order & Save';
  return 'Print Bill & Save';
}

function renderCartLines() {
  if (!CART.length) return `<div class="cart-empty">No items yet — tap a menu item to add it.</div>`;
  return CART.map(l => `
    <div class="cart-line">
      <div class="nm">${l.name}<small>${l.price === 0 ? 'FREE' : rupee(l.price) + ' each'}</small></div>
      <div class="qty-ctl">
        <button data-act="dec" data-id="${l.id}">−</button>
        <span>${l.qty}</span>
        <button data-act="inc" data-id="${l.id}">+</button>
      </div>
      <div class="lt">${rupee(l.price * l.qty)}</div>
      <button class="rm" data-act="rm" data-id="${l.id}">✕</button>
    </div>
  `).join('');
}
function cartTotal() { return CART.reduce((s, l) => s + l.price * l.qty, 0); }

function attachStaffEvents(menuKey) {
  document.getElementById('logout-btn').addEventListener('click', logout);
  const barBtn = document.getElementById('bar-orders-btn');
  if (barBtn) barBtn.addEventListener('click', openBarOrdersModal);
  const statusBtn = document.getElementById('bar-status-btn');
  if (statusBtn) statusBtn.addEventListener('click', openBarOrdersModal);
  startPolling();
  bindBillingEvents(menuKey);
}

function bindBillingEvents(menuKey, refreshFn) {
  const refresh = refreshFn || (() => refreshBillingArea(menuKey));
  document.querySelectorAll('.item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const mk = btn.dataset.menu;
      const all = STATE.menus[mk].flatMap(c => c.items);
      const item = all.find(i => i.id === id);
      const existing = CART.find(l => l.id === id);
      if (existing) { existing.qty++; } else { CART.push({ id: item.id, name: item.name, price: item.price, qty: 1 }); }
      refresh();
    });
  });
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) checkoutBtn.addEventListener('click', () => checkout(menuKey, refresh));
  const clearBtn = document.getElementById('clear-cart-btn');
  if (clearBtn) clearBtn.addEventListener('click', () => { CART = []; refresh(); });
  document.querySelectorAll('.qty-ctl button, .rm').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const line = CART.find(l => l.id === id);
      if (!line) return;
      if (act === 'inc') line.qty++;
      else if (act === 'dec') { line.qty--; if (line.qty <= 0) CART = CART.filter(l => l.id !== id); }
      else if (act === 'rm') CART = CART.filter(l => l.id !== id);
      refresh();
    });
  });
  const mobileBar = document.getElementById('mobile-cart-bar');
  if (mobileBar) mobileBar.addEventListener('click', () => { CART_DRAWER_OPEN = true; refresh(); });
  const closeBtn = document.getElementById('cart-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', () => { CART_DRAWER_OPEN = false; refresh(); });
  const paperSelect = document.getElementById('paper-width-select');
  if (paperSelect) paperSelect.addEventListener('change', () => setPaperWidth(paperSelect.value));
}

function refreshBillingArea(menuKey) {
  document.querySelector('.content').innerHTML = renderBillingArea(menuKey);
  bindBillingEvents(menuKey);
}

async function checkout(menuKey, refreshFn) {
  if (!CART.length) return;
  const refresh = refreshFn || (() => refreshBillingArea(menuKey));
  const note = document.getElementById('order-note').value.trim();
  const items = CART.map(l => ({ id: l.id, name: l.name, price: l.price, qty: l.qty }));

  let customerMobile = '';
  let customerName = '';
  if (ROLE !== 'bar') {
    const nameInput = document.getElementById('customer-name');
    customerName = (nameInput ? nameInput.value : '').trim();
    const mobileInput = document.getElementById('customer-mobile');
    customerMobile = (mobileInput ? mobileInput.value : '').replace(/\D/g, '');
  }

  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) { checkoutBtn.disabled = true; checkoutBtn.textContent = 'Saving…'; }

  const ctx = { menuKey, items, note, customerName, customerMobile, refresh };

  // Bar orders aren't paid at the table — they're relayed downstairs for
  // printing, so there's no Cash/GPay choice to make here.
  if (ROLE === 'bar') {
    await submitOrder(ctx, 'cash');
    return;
  }
  openPaymentModal(ctx);
}

function resetCheckoutBtn() {
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) { checkoutBtn.disabled = false; checkoutBtn.textContent = checkoutBtnLabel(); }
}

// Saves the order as-is (used for Cash, and for the bar's auto-relay path).
async function submitOrder(ctx, paymentMethod) {
  try {
    const data = await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        menuKey: ctx.menuKey, items: ctx.items, note: ctx.note,
        customerMobile: ctx.customerMobile, customerName: ctx.customerName,
        paymentMethod
      })
    });
    await finishCheckout(data.order, ctx.menuKey, ctx.customerMobile, ctx.refresh);
  } catch (e) {
    showToast('Could not save order: ' + e.message);
    resetCheckoutBtn();
  }
}

// Common "order is now saved/paid" tail — prints the bill for staff/admin
// so it can be handed to the customer at the counter, or just relays it
// (bar), then clears the cart.
// NOTE: bills are no longer auto-sent to the customer's mobile (SMS/
// WhatsApp) — sendBillSms/sendBillWhatsAppPhoto below are kept intact in
// case that flow is switched back on later, they're just not called here.
async function finishCheckout(order, menuKey, customerMobile, refresh) {
  if (menuKey === 'bar') markPrinted(order.billNo);
  if (ROLE === 'bar') {
    showToast('Order sent to ground floor for printing.');
  } else {
    printReceipt(order);
  }
  CART = [];
  CART_DRAWER_OPEN = false;
  refresh();
}

/* ---- Cash / GPay payment modal ---- */
function openPaymentModal(ctx) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
  <div class="modal-overlay" id="pay-modal-overlay">
    <div class="modal-box" style="text-align:center;">
      <h3>How is the customer paying?</h3>
      <p>Order total: <strong>${rupee(cartTotal())}</strong></p>
      <div style="display:flex;gap:10px;margin:14px 0;">
        <button class="checkout-btn" id="pay-cash-btn" style="flex:1;">💵 Cash</button>
        <button class="checkout-btn" id="pay-gpay-btn" style="flex:1;">📲 GPay</button>
      </div>
      <button class="modal-close" id="pay-modal-cancel">Cancel</button>
    </div>
  </div>`;
  const cancel = () => { closeModal(); resetCheckoutBtn(); };
  document.getElementById('pay-modal-overlay').addEventListener('click', e => { if (e.target.id === 'pay-modal-overlay') cancel(); });
  document.getElementById('pay-modal-cancel').addEventListener('click', cancel);
  document.getElementById('pay-cash-btn').addEventListener('click', () => { closeModal(); submitOrder(ctx, 'cash'); });
  document.getElementById('pay-gpay-btn').addEventListener('click', () => openGpayAmountModal(ctx));
}

let UPI_CONFIG = null;
async function loadUpiConfig() {
  if (UPI_CONFIG) return UPI_CONFIG;
  try {
    UPI_CONFIG = await (await fetch('/api/upi-config')).json();
  } catch (e) {
    UPI_CONFIG = { upiId: '', payeeName: 'Unlimited Parotta' };
  }
  return UPI_CONFIG;
}
function buildUpiRawLinkLocal(upiId, payeeName, amount, billRef) {
  const params = new URLSearchParams({ pa: upiId, pn: payeeName, am: String(amount), cu: 'INR', tn: billRef });
  return `upi://pay?${params.toString()}`;
}

function openGpayAmountModal(ctx) {
  const root = document.getElementById('modal-root');
  const total = cartTotal();
  root.innerHTML = `
  <div class="modal-overlay" id="gpay-amount-overlay">
    <div class="modal-box">
      <h3>GPay / UPI Amount</h3>
      <p>Defaults to the order total — change it if the customer is paying a different amount.</p>
      <div class="field">
        <label>Amount (₹)</label>
        <input type="number" id="gpay-amount-input" value="${total}" min="1" step="1" inputmode="decimal">
      </div>
      <button class="checkout-btn" id="gpay-generate-btn" style="width:100%;">Generate QR</button>
      <button class="modal-close" id="gpay-amount-back">Back</button>
    </div>
  </div>`;
  document.getElementById('gpay-amount-back').addEventListener('click', () => openPaymentModal(ctx));
  document.getElementById('gpay-amount-overlay').addEventListener('click', e => { if (e.target.id === 'gpay-amount-overlay') { closeModal(); resetCheckoutBtn(); } });
  const amountInput = document.getElementById('gpay-amount-input');
  amountInput.focus();
  amountInput.select();
  document.getElementById('gpay-generate-btn').addEventListener('click', async () => {
    const amount = Number(amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) { showToast('Enter a valid amount'); return; }
    const btn = document.getElementById('gpay-generate-btn');
    btn.disabled = true; btn.textContent = 'Generating…';
    try {
      const cfg = await loadUpiConfig();
      if (!cfg.upiId) throw new Error('UPI isn\'t set up yet — add UPI_ID to your .env file (Admin/README has the steps).');
      const upiLink = buildUpiRawLinkLocal(cfg.upiId, cfg.payeeName, amount, `Order ${new Date().toISOString().slice(0, 10)}`);
      const qrDataUrl = await QRCode.toDataURL(upiLink, { width: 260, margin: 1 });
      openGpayQrModal(ctx, { imageUrl: qrDataUrl, amount });
    } catch (e) {
      showToast('Could not create UPI QR: ' + e.message);
      btn.disabled = false; btn.textContent = 'Generate QR';
    }
  });
}

function openGpayQrModal(ctx, data) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
  <div class="modal-overlay" id="gpay-qr-overlay">
    <div class="modal-box" style="text-align:center;">
      <h3>Scan to Pay</h3>
      <p>₹${data.amount} — hand the phone to the customer to scan with GPay, PhonePe, Paytm, or any UPI app.</p>
      <img src="${data.imageUrl}" alt="UPI QR code" style="width:220px;height:220px;margin:10px auto;display:block;border-radius:10px;background:#fff;padding:8px;">
      <p style="color:var(--muted);font-size:12.5px;">This QR isn't linked to a payment gateway, so tap the button below once the customer shows you the "Payment Successful" screen in their UPI app.</p>
      <button class="checkout-btn" id="gpay-confirm-btn" style="width:100%;margin-bottom:8px;">✅ Payment Received</button>
      <button class="modal-close" id="gpay-qr-cancel">Cancel</button>
    </div>
  </div>`;
  document.getElementById('gpay-qr-cancel').addEventListener('click', () => {
    closeModal();
    resetCheckoutBtn();
  });
  document.getElementById('gpay-confirm-btn').addEventListener('click', () => {
    closeModal();
    submitOrder(ctx, 'gpay');
  });
}

function billStatusMessage(smsResult, waResult) {
  const smsPart = smsResult.ok ? 'SMS sent' : `SMS failed (${smsResult.error || 'unknown error'})`;
  const wa = waResult.result;
  if (wa === 'sent') return `${smsPart}. WhatsApp bill photo sent.`;
  if (wa === 'shared') return `${smsPart}. Bill photo shared on WhatsApp.`;
  if (wa === 'downloaded') return `${smsPart}. WhatsApp auto-send failed (${waResult.error || 'not set up yet'}) — bill photo downloaded, attach it in the WhatsApp chat that just opened.`;
  if (wa === 'cancelled') return `${smsPart}. Share cancelled — opening WhatsApp so you can attach the photo…`;
  return `${smsPart}. Could not send WhatsApp bill photo (${waResult.error || 'unknown error'}).`;
}

function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* Draws a clean, professional receipt-style image of the bill on a canvas,
   with a scannable UPI QR code (opens GPay/PhonePe/Paytm directly) and a
   rating prompt at the bottom. This is what gets shared/downloaded as the
   "bill photo". */
async function generateBillImageBlob(order) {
  const width = 380;
  const rowH = 22;
  const qrSize = 150;
  const payBlockH = order.upiLink ? (36 + qrSize + 40) : 60;
  const rateBlockH = 90;
  const infoBlockH = 227; // header + BILL info (incl. Payment row) + customer block + words line
  const height = infoBlockH + 60 + (order.items.length * rowH) + 40 + payBlockH + rateBlockH + 90;

  const canvas = document.createElement('canvas');
  const scale = 2; // sharper output
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const divider = (y, strong) => {
    ctx.strokeStyle = strong ? '#111827' : '#d1d5db';
    ctx.lineWidth = strong ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
    ctx.lineWidth = 1;
  };

  let y = 32;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillText(SHOP_INFO.name, width / 2, y); y += 20;
  ctx.font = '11px Arial, sans-serif';
  ctx.fillStyle = '#4b5563';
  if (SHOP_INFO.tagline) { ctx.fillText(SHOP_INFO.tagline, width / 2, y); y += 16; }
  y += 4;
  divider(y, true); y += 20;

  SHOP_INFO.addressLines.forEach(l => { ctx.fillText(l, width / 2, y); y += 15; });
  if (SHOP_INFO.phone) { ctx.fillText('Ph: +91 ' + SHOP_INFO.phone, width / 2, y); y += 15; }
  y += 6;
  divider(y, true); y += 22;

  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.fillStyle = '#111827';
  ctx.fillText('BILL', width / 2, y); y += 20;

  ctx.font = '12px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Bill No  : ${formatBillCode(order)}`, 20, y); y += 17;
  ctx.fillText(`Date     : ${billDateStr(order.time)}`, 20, y); y += 17;
  ctx.fillText(`Time     : ${billTimeStr(order.time)}`, 20, y); y += 17;
  ctx.fillText(`Table No : ${order.note || '-'}`, 20, y); y += 17;
  ctx.fillText(`Cashier  : ${order.servedBy}`, 20, y); y += 17;
  ctx.fillText(`Payment  : ${order.paymentMethod === 'gpay' ? 'GPay (Paid \u2713)' : 'Cash'}`, 20, y); y += 12;
  divider(y); y += 20;

  ctx.fillText(`Customer : ${order.customerName || '-'}`, 20, y); y += 17;
  ctx.fillText(`Mobile   : ${order.customerMobile ? '+91 ' + order.customerMobile : '-'}`, 20, y); y += 12;
  divider(y); y += 22;

  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.textAlign = 'left'; ctx.fillText('S.No  Item', 20, y);
  ctx.textAlign = 'center'; ctx.fillText('Qty', width - 150, y);
  ctx.textAlign = 'right'; ctx.fillText('Rate', width - 95, y);
  ctx.fillText('Amount', width - 20, y);
  y += 8;
  divider(y); y += 18;

  ctx.font = '12px Arial, sans-serif';
  order.items.forEach((it, i) => {
    ctx.textAlign = 'left'; ctx.fillText(`${i + 1}.  ${it.name}`, 20, y);
    ctx.textAlign = 'center'; ctx.fillText(String(it.qty), width - 150, y);
    ctx.textAlign = 'right';
    ctx.fillText(it.price === 0 ? 'FREE' : rupee(it.price), width - 95, y);
    ctx.fillText(it.price === 0 ? 'FREE' : rupee(it.price * it.qty), width - 20, y);
    y += rowH;
  });
  divider(y); y += 24;

  ctx.textAlign = 'left';
  ctx.font = '13px Arial, sans-serif';
  ctx.fillText('Sub Total', 20, y);
  ctx.textAlign = 'right';
  ctx.fillText(rupee(order.total), width - 20, y);
  y += 20;
  divider(y, true); y += 22;

  ctx.textAlign = 'left';
  ctx.font = 'bold 17px Arial, sans-serif';
  ctx.fillText('GRAND TOTAL', 20, y);
  ctx.textAlign = 'right';
  ctx.fillText(rupee(order.total), width - 20, y);
  y += 20;
  divider(y, true); y += 20;

  ctx.textAlign = 'center';
  ctx.font = 'italic 11px Arial, sans-serif';
  ctx.fillStyle = '#4b5563';
  ctx.fillText(`(${amountInWords(order.total)})`, width / 2, y); y += 24;
  ctx.fillStyle = '#111827';

  ctx.font = 'bold 14px Arial, sans-serif';
  ctx.fillText('Thank You! Visit Again!', width / 2, y); y += 20;
  divider(y); y += 18;

  ctx.textAlign = 'left';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.fillText('OPENING HOURS:', 20, y); y += 16;
  ctx.font = '11px Arial, sans-serif';
  ctx.fillStyle = '#4b5563';
  SHOP_INFO.hoursLines.forEach(h => { ctx.fillText(h, 20, y); y += 15; });
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'center';
  y += 6;
  ctx.fillText('DINE IN  |  TAKE AWAY  |  HOME DELIVERY', width / 2, y); y += 16;
  divider(y, true); y += 24;

  /* ---- Scan to Pay: real UPI QR, opens GPay / PhonePe / Paytm directly ---- */
  ctx.textAlign = 'center';
  if (order.upiLink) {
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText('📲 SCAN TO PAY', width / 2, y); y += 20;
    try {
      const qrDataUrl = await QRCode.toDataURL(order.upiLink, { width: qrSize * 2, margin: 1 });
      const qrImg = await loadImageEl(qrDataUrl);
      ctx.drawImage(qrImg, (width - qrSize) / 2, y, qrSize, qrSize);
    } catch (e) {
      ctx.font = '11px Arial, sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText('(QR unavailable — use the Pay Now link)', width / 2, y + qrSize / 2);
    }
    y += qrSize + 14;
    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('Works with GPay · PhonePe · Paytm · any UPI app', width / 2, y); y += 22;
  } else {
    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Online payment coming soon — please pay at the counter', width / 2, y); y += 20;
  }
  divider(y); y += 24;

  /* ---- Rating prompt ---- */
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.fillStyle = '#111827';
  ctx.fillText('Enjoyed your meal?', width / 2, y); y += 24;
  ctx.font = '22px Arial, sans-serif';
  ctx.fillText('⭐ ⭐ ⭐ ⭐ ⭐', width / 2, y); y += 22;
  ctx.font = '11px Arial, sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('We\'d love to hear your feedback!', width / 2, y); y += 26;

  ctx.font = 'italic 12px Arial, sans-serif';
  ctx.fillText('Thank you for dining with us — visit again soon!', width / 2, y);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result); // data:image/png;base64,...
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* Sends the bill photo to the customer's WhatsApp automatically via the
   server (Supabase upload + WhatsApp Business API) — this is the normal
   path once WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID are configured.
   If that isn't set up yet, falls back to the native Share sheet
   (one tap -> pick WhatsApp -> photo attached), or downloading the PNG
   so it can be attached manually. */
async function sendBillWhatsAppPhoto(order, mobile) {
  let blob;
  try {
    blob = await generateBillImageBlob(order);
  } catch (e) {
    return { result: 'failed', error: e.message };
  }

  let serverError = null;
  try {
    const imageBase64 = await blobToBase64(blob);
    await api('/api/send-whatsapp-bill', {
      method: 'POST',
      body: JSON.stringify({ billNo: order.billNo, mobile, imageBase64 })
    });
    return { result: 'sent' };
  } catch (e) {
    // Server-side WhatsApp send failed (often just "not set up yet") —
    // fall back to the Share sheet / manual download + note. Keep the
    // real error so it can still be shown even after falling back.
    serverError = e.message;
  }

  try {
    const file = new File([blob], `bill-${order.billNo}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `Bill #${order.billNo}`,
        text: `${SHOP_INFO.name} — Bill #${order.billNo} — ${rupee(order.total)}`
      });
      return { result: 'shared', error: serverError };
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-${order.billNo}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    sendBillWhatsAppNote(order, mobile, 'downloaded');
    return { result: 'downloaded', error: serverError };
  } catch (e) {
    if (e && e.name === 'AbortError') return { result: 'cancelled', error: serverError };
    return { result: 'failed', error: serverError || e.message };
  }
}

/* Bills the customer via a real SMS instead of printing (Unlimited Staff counter).
   Kept short and fixed-wording on purpose — this text should match your
   DLT-approved template once you register one with your SMS provider.
   Returns true/false so checkout() can show one combined status message. */
/* Bills the customer via a real SMS instead of printing (Unlimited Staff counter).
   Kept short and fixed-wording on purpose — this text should match your
   DLT-approved template once you register one with your SMS provider.
   Two variants now exist (unpaid/"pay now" vs already-paid-via-GPay) — if
   you're on MSG91 with DLT templates, register BOTH wordings as separate
   approved templates, or your SMS provider will silently block whichever
   one isn't registered.
   Returns true/false so checkout() can show one combined status message. */
async function sendBillSms(order, mobile) {
  const greetName = order.customerName ? `Dear ${order.customerName}` : 'Dear Customer';
  const message = order.paymentMethod === 'gpay'
    ? `${greetName}, thank you for visiting ${SHOP_INFO.name}! Your Bill No ${formatBillCode(order)} amount ${rupee(order.total)} has been received via GPay. Visit again soon!`
    : `${greetName}, thank you for visiting ${SHOP_INFO.name}! Your Bill No ${formatBillCode(order)} amount is ${rupee(order.total)}. Pay now: ${buildPayLink(order)} Visit again soon!`;
  try {
    await api('/api/send-sms', { method: 'POST', body: JSON.stringify({ mobile, message }) });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* WhatsApp is meant to carry the bill PHOTO, not a text bill — a browser
   can't attach a file to a wa.me link, so this only opens a short note
   asking the customer to check the photo that was just downloaded/shared
   on the device. Keep it brief on purpose; the itemized bill lives in the
   photo, not here. */
function sendBillWhatsAppNote(order, mobile, photoResult) {
  const digits = String(mobile).replace(/\D/g, '');
  const withCountryCode = digits.length === 10 ? '91' + digits : digits;
  const greetName = order.customerName ? order.customerName : 'there';
  const photoLine = photoResult === 'downloaded'
    ? '📎 Your bill photo has been downloaded on this device — attaching it here now.'
    : '📎 Please find your bill photo attached.';
  const lines = [
    `Hi ${greetName}, thank you for visiting ${SHOP_INFO.name}!`,
    `Bill No: ${formatBillCode(order)} — ${rupee(order.total)}`,
    photoLine
  ];
  const text = encodeURIComponent(lines.join('\n'));
  window.open(`https://wa.me/${withCountryCode}?text=${text}`, '_blank');
}

// Thermal receipt — built as real HTML rows (flexbox), not a monospace
// character-padded block. Monospace column math assumes the printer's font
// renders every character at an identical fixed width; real thermal
// printers/drivers don't always honour that, which is what caused item
// rows to wrap/misalign in practice. Flexbox rows (name grows, qty/amount
// fixed-width right-aligned) stay aligned regardless of font. The WhatsApp
// bill photo (generateBillImageBlob, below) is a separate canvas render and
// is untouched by this.
function infoRow(label, value) {
  return `<div class="r-row"><span class="r-label">${escapeHtml(label)}</span><span class="r-value">${escapeHtml(value)}</span></div>`;
}
function printReceipt(order) {
  const el = document.getElementById('receipt-print');
  let html = '';

  html += `<div class="r-shop">${escapeHtml(SHOP_INFO.name)}</div>`;
  if (SHOP_INFO.tagline) html += `<div class="r-tagline">${escapeHtml(SHOP_INFO.tagline)}</div>`;
  html += `<div class="r-div"></div>`;
  SHOP_INFO.addressLines.forEach(l => { html += `<div class="r-addr">${escapeHtml(l)}</div>`; });
  if (SHOP_INFO.phone) html += `<div class="r-addr">Ph: +91 ${escapeHtml(SHOP_INFO.phone)}</div>`;
  html += `<div class="r-div"></div>`;

  html += `<div class="r-title">BILL</div>`;
  html += infoRow('Bill No', `#${order.billNo}`);
  html += infoRow('Date', billDateHuman(order.time));
  html += infoRow('Time', billTimeStr(order.time));
  html += infoRow('Table/Token', order.note || '-');
  html += infoRow('Cashier', order.servedBy);
  html += infoRow('Payment', order.paymentMethod === 'gpay' ? 'GPay / UPI' : 'Cash');
  html += `<div class="r-div"></div>`;

  if (order.customerName || order.customerMobile) {
    if (order.customerName) html += infoRow('Customer', order.customerName);
    if (order.customerMobile) html += infoRow('Mobile', '+91 ' + order.customerMobile);
    html += `<div class="r-div"></div>`;
  }

  html += `<div class="r-item r-item-head"><span class="r-iname">Item</span><span class="r-iqty">Qty</span><span class="r-iamt">Amount</span></div>`;
  html += `<div class="r-div"></div>`;
  order.items.forEach(it => {
    const amt = it.price === 0 ? 'FREE' : rupee(it.price * it.qty);
    html += `<div class="r-item"><span class="r-iname">${escapeHtml(it.name)}</span><span class="r-iqty">${it.qty}</span><span class="r-iamt">${amt}</span></div>`;
  });
  html += `<div class="r-div"></div>`;

  html += `<div class="r-row"><span>Subtotal</span><span>${rupee(order.total)}</span></div>`;
  html += `<div class="r-div"></div>`;
  html += `<div class="r-row r-total"><span>GRAND TOTAL</span><span>${rupee(order.total)}</span></div>`;
  html += `<div class="r-div"></div>`;
  html += `<div class="r-words">(${escapeHtml(amountInWords(order.total))})</div>`;
  html += `<div class="r-div"></div>`;

  html += `<div class="r-thanks">Thank You! Visit Again!</div>`;
  html += `<div class="r-small">OPENING HOURS:</div>`;
  SHOP_INFO.hoursLines.forEach(h => { html += `<div class="r-small">${escapeHtml(h)}</div>`; });
  html += `<div class="r-small">DINE IN | TAKE AWAY | HOME DELIVERY</div>`;

  el.innerHTML = `<div class="receipt-mono">${html}</div>`;
  setTimeout(() => window.print(), 150);
}

/* ================= BAR <-> GROUND FLOOR ORDER SYNC ================= */
function orderStatusLabel(status) {
  return ({ new: '🟠 NEW ORDER', accepted: '🟡 ACCEPTED', preparing: '🔵 PREPARING', ready: '🟢 ORDER READY', completed: '⚪ COMPLETED' })[status || 'new'] || String(status || 'NEW').toUpperCase();
}
function orderStatusClass(status) {
  return ({ new: 'new', accepted: 'accepted', preparing: 'preparing', ready: 'ready', completed: 'completed' })[status || 'new'] || 'new';
}
function nextOrderAction(status) {
  return ({ new: 'ACCEPT', accepted: 'START PREPARING', preparing: 'MARK READY' })[status || 'new'] || null;
}
function activeBarOrders() {
  return BAR_ORDERS.filter(o => (o.status || 'new') !== 'completed');
}
async function updateBarOrderStatus(billNo, status) {
  try {
    await api(`/api/orders/${billNo}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    await pollBarOrders();
    openBarOrdersModal();
  } catch (e) {
    showToast('Could not update order: ' + e.message);
  }
}
function startPolling() {
  if (POLL_TIMER) return;
  POLL_TIMER = setInterval(pollBarOrders, 5000);
  pollBarOrders();
}
async function pollBarOrders() {
  try {
    const data = await api('/api/orders?menuKey=bar&limit=50');
    const orders = (data.orders || []).map(o => ({ ...o, status: o.status || 'new' }));
    const previous = BAR_STATUS_SNAPSHOT;
    BAR_ORDERS = orders;

    if (ROLE === 'staff' || ROLE === 'admin') {
      const fresh = orders.filter(o => o.status === 'new' && !PRINTED_BILLNOS.has(o.billNo) && !PENDING_BAR_ORDERS.find(p => p.billNo === o.billNo));
      if (fresh.length) {
        PENDING_BAR_ORDERS = PENDING_BAR_ORDERS.concat(fresh);
        beep();
        if (AUTO_PRINT) {
          fresh.forEach(o => { printReceipt(o); markPrinted(o.billNo); });
          PENDING_BAR_ORDERS = PENDING_BAR_ORDERS.filter(p => !fresh.find(f => f.billNo === p.billNo));
        }
      }
      refreshTopbarBadge();
    }

    if (ROLE === 'bar') {
      const becameReady = orders.some(o => o.status === 'ready' && previous.get(o.billNo) && previous.get(o.billNo) !== 'ready');
      if (becameReady) {
        beep();
        const ready = orders.filter(o => o.status === 'ready' && previous.get(o.billNo) !== 'ready');
        ready.forEach(o => showToast(`🟢 Order ${formatBillCode(o)} is READY — collect from ground floor.`));
      }
      refreshBarStatusBadge();
    }

    BAR_STATUS_SNAPSHOT = new Map(orders.map(o => [o.billNo, o.status]));
  } catch (e) { /* offline or logged out — silently retry next cycle */ }
}
function refreshTopbarBadge() {
  const btn = document.getElementById('bar-orders-btn');
  const newCount = BAR_ORDERS.filter(o => (o.status || 'new') === 'new').length;
  if (btn) btn.innerHTML = `🔔 Bar orders${newCount ? ` <span class="cnt">${newCount}</span>` : ''}`;
}
function refreshBarStatusBadge() {
  const btn = document.getElementById('bar-status-btn');
  const readyCount = BAR_ORDERS.filter(o => (o.status || 'new') === 'ready').length;
  if (btn) btn.innerHTML = `🔔 Order status${readyCount ? ` <span class="cnt">${readyCount}</span>` : ''}`;
}
function openBarOrdersModal() {
  const root = document.getElementById('modal-root');
  const isBar = ROLE === 'bar';
  const orders = activeBarOrders().slice().reverse();
  root.innerHTML = `
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-box">
      <h3>${isBar ? 'Rhythm Bar — Order Status' : 'Incoming Bar Orders'}</h3>
      <p>${isBar ? 'Track every order sent to the ground floor.' : 'Orders placed upstairs at Rhythm Bar. Accept, prepare and mark them READY.'}</p>
      ${!isBar ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);margin-bottom:10px;">
        <span>Auto-print incoming orders</span>
        <input type="checkbox" id="autoprint-toggle" ${AUTO_PRINT ? 'checked' : ''}>
      </div>` : ''}
      ${orders.length ? orders.map(o => {
        const status = o.status || 'new';
        const action = !isBar ? nextOrderAction(status) : (status === 'ready' ? 'MARK COLLECTED' : null);
        const nextStatus = !isBar ? ({ new: 'accepted', accepted: 'preparing', preparing: 'ready' }[status]) : (status === 'ready' ? 'completed' : null);
        return `<div class="order-notif-item" style="margin-bottom:12px;">
          <div class="top"><span><strong>${formatBillCode(o)}</strong>${o.note ? ' · ' + escapeHtml(o.note) : ''}</span><span>${rupee(o.total)}</span></div>
          <div style="margin:6px 0;font-weight:800;">${orderStatusLabel(status)}</div>
          <div class="items">${o.items.map(it => escapeHtml(it.name) + ' ×' + it.qty).join(', ')}</div>
          ${!isBar ? `<div class="acts">
            <button class="tiny-btn" data-print-status="${o.billNo}">🖨️ Print</button>
            ${action ? `<button class="tiny-btn" data-status-action="${o.billNo}" data-next-status="${nextStatus}">${action}</button>` : ''}
          </div>` : `<div class="acts">${action ? `<button class="tiny-btn" data-status-action="${o.billNo}" data-next-status="${nextStatus}">✅ ${action}</button>` : ''}</div>`}
        </div>`;
      }).join('') : `<p style="text-align:center;color:var(--muted);">No active bar orders.</p>`}
      <button class="modal-close" id="close-bar-modal">Close</button>
    </div>
  </div>`;

  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target.id === 'modal-overlay') closeModal(); });
  document.getElementById('close-bar-modal').addEventListener('click', closeModal);
  const autoToggle = document.getElementById('autoprint-toggle');
  if (autoToggle) autoToggle.addEventListener('change', e => {
    AUTO_PRINT = e.target.checked;
    localStorage.setItem(AUTOPRINT_KEY, AUTO_PRINT ? 'on' : 'off');
  });
  document.querySelectorAll('[data-print-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      const order = BAR_ORDERS.find(o => o.billNo === Number(btn.dataset.printStatus));
      if (order) printReceipt(order);
    });
  });
  document.querySelectorAll('[data-status-action]').forEach(btn => {
    btn.addEventListener('click', () => updateBarOrderStatus(Number(btn.dataset.statusAction), btn.dataset.nextStatus));
  });
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

/* ================= ADMIN SHELL ================= */
function renderAdminShell() {
  return `
  <div class="shell">
    <div class="topbar">
      <div class="who"><span class="dot"></span><h2>Admin Dashboard</h2></div>
      <div class="topbar-actions">
        <button class="sync-badge" id="bar-orders-btn">🔔 Bar orders${PENDING_BAR_ORDERS.length ? ` <span class="cnt">${PENDING_BAR_ORDERS.length}</span>` : ''}</button>
        <span class="pill-btn">${LABEL}</span>
        <button class="pill-btn logout" id="logout-btn">Log out</button>
      </div>
    </div>
    <div class="tabs">
      <button class="tab-btn ${ADMIN_TAB === 'billing' ? 'active' : ''}" data-tab="billing">New Bill</button>
      <button class="tab-btn ${ADMIN_TAB === 'reports' ? 'active' : ''}" data-tab="reports">Reports</button>
      <button class="tab-btn ${ADMIN_TAB === 'menu' ? 'active' : ''}" data-tab="menu">Menu Management</button>
      <button class="tab-btn ${ADMIN_TAB === 'staff' ? 'active' : ''}" data-tab="staff">Staff Access</button>
    </div>
    <div class="content">${renderAdminTab()}</div>
  </div>`;
}

function renderAdminTab() {
  if (ADMIN_TAB === 'billing') return renderAdminBillingTab();
  if (ADMIN_TAB === 'reports') return `<div id="reports-root">Loading…</div>`;
  if (ADMIN_TAB === 'menu') return renderMenuMgmtTab();
  if (ADMIN_TAB === 'staff') return renderStaffAccessTab();
  return '';
}

function renderAdminBillingTab() {
  return `
    <div class="filters">
      <div class="field">
        <label>Counter</label>
        <select id="admin-counter-select">
          <option value="unlimited" ${ADMIN_BILL_COUNTER === 'unlimited' ? 'selected' : ''}>Unlimited Parotta</option>
          <option value="bar" ${ADMIN_BILL_COUNTER === 'bar' ? 'selected' : ''}>Rhythm Bar</option>
        </select>
      </div>
    </div>
    ${renderBillingArea(ADMIN_BILL_COUNTER)}
  `;
}

async function renderReportsTab() {
  const root = document.getElementById('reports-root');
  if (!root) return;
  let orders = [];
  try {
    const data = await api('/api/orders?limit=500');
    orders = data.orders;
  } catch (e) { root.innerHTML = `<p style="color:var(--muted);">Could not load reports: ${e.message}</p>`; return; }

  const today = todayStr();
  const todayOrders = orders.filter(o => todayStr(o.time) === today);
  const todayTotal = todayOrders.reduce((s, o) => s + o.total, 0);
  const unlimitedTotal = todayOrders.filter(o => o.menuKey === 'unlimited').reduce((s, o) => s + o.total, 0);
  const barTotal = todayOrders.filter(o => o.menuKey === 'bar').reduce((s, o) => s + o.total, 0);
  const allTimeTotal = orders.reduce((s, o) => s + o.total, 0);
  const recent = [...orders].reverse().slice(0, 60);

  root.innerHTML = `
  <div class="reports-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
    <h3 style="margin:0;">Today's Summary</h3>
    <button class="tiny-btn" id="print-overall-btn">🖨️ Print Overall Bill</button>
  </div>
  <div class="grid-cards">
    <div class="stat-card"><div class="lbl">Today's Bills</div><div class="val">${todayOrders.length}</div></div>
    <div class="stat-card"><div class="lbl">Today's Sales</div><div class="val">${rupee(todayTotal)}</div></div>
    <div class="stat-card"><div class="lbl">Unlimited Parotta (today)</div><div class="val">${rupee(unlimitedTotal)}</div></div>
    <div class="stat-card gold"><div class="lbl">Rhythm Bar (today)</div><div class="val">${rupee(barTotal)}</div></div>
    <div class="stat-card"><div class="lbl">All-time Sales</div><div class="val">${rupee(allTimeTotal)}</div></div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Bill#</th><th>Counter</th><th>Time</th><th>Items</th><th>Note</th><th>Customer</th><th>Customer #</th><th>Served By</th><th>Total</th><th></th></tr></thead>
      <tbody>
        ${recent.map(o => `
          <tr>
            <td>${formatBillCode(o)}</td>
            <td><span class="badge ${o.menuKey === 'bar' ? 'rhythm' : 'unlimited'}">${counterLabel(o.menuKey)}</span></td>
            <td>${niceDateTime(o.time)}</td>
            <td>${o.items.map(it => it.name + ' x' + it.qty).join(', ')}</td>
            <td>${o.note || '—'}</td>
            <td>${o.customerName || '—'}</td>
            <td>${o.customerMobile || '—'}</td>
            <td>${o.servedBy}</td>
            <td>${rupee(o.total)}</td>
            <td><button class="tiny-btn" data-reprint="${o.billNo}">Reprint</button></td>
          </tr>
        `).join('') || `<tr><td colspan="10" style="color:var(--muted);text-align:center;">No bills yet.</td></tr>`}
      </tbody>
    </table>
  </div>`;

  document.querySelectorAll('[data-reprint]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bn = Number(btn.dataset.reprint);
      const order = orders.find(o => o.billNo === bn);
      if (order) printReceipt(order);
    });
  });

  const overallBtn = document.getElementById('print-overall-btn');
  if (overallBtn) {
    overallBtn.addEventListener('click', () => {
      printOverallBill({ today, todayOrders, todayTotal, unlimitedTotal, barTotal, allTimeTotal, allOrdersCount: orders.length });
    });
  }
}

/* Consolidated day-end "Overall Bill" — a summary receipt of the day's
   business across both counters, printable from Admin → Reports. */
function printOverallBill({ today, todayOrders, todayTotal, unlimitedTotal, barTotal, allTimeTotal, allOrdersCount }) {
  const unlimitedCount = todayOrders.filter(o => o.menuKey === 'unlimited').length;
  const barCount = todayOrders.filter(o => o.menuKey === 'bar').length;
  const el = document.getElementById('receipt-print');
  const W = RECEIPT_WIDTH;
  const lines = [];
  lines.push(centerText(SHOP_INFO.name, W));
  if (SHOP_INFO.tagline) lines.push(centerText(SHOP_INFO.tagline, W));
  SHOP_INFO.addressLines.forEach(l => lines.push(centerText(l, W)));
  if (SHOP_INFO.phone) lines.push(centerText(`Ph: +91 ${SHOP_INFO.phone}`, W));
  lines.push(receiptDivider());
  lines.push(centerText('OVERALL BILL - DAY SUMMARY', W));
  lines.push(`Date    : ${today}`);
  lines.push(`Printed : ${niceDateTime(new Date().toISOString())}`);
  lines.push(receiptDivider());
  lines.push(itemRow('Counter', 'Bills', 'Amount'));
  lines.push(receiptDivider());
  lines.push(itemRow('Unlimited Parotta', String(unlimitedCount), rupee(unlimitedTotal)));
  lines.push(itemRow('Rhythm Bar', String(barCount), rupee(barTotal)));
  lines.push(receiptDivider());
  lines.push(itemRow('Total Bills Today', '', String(todayOrders.length)));
  lines.push(itemRow('TOTAL SALES TODAY', '', rupee(todayTotal)));
  lines.push(receiptDivider());
  lines.push(itemRow('All-Time Bills', '', String(allOrdersCount)));
  lines.push(itemRow('All-Time Sales', '', rupee(allTimeTotal)));
  lines.push(receiptDivider());
  lines.push('');
  lines.push(centerText('Internal summary - not a customer receipt.', W));

  el.innerHTML = `<pre class="receipt-mono">${lines.join('\n')}</pre>`;
  setTimeout(() => window.print(), 150);
}

function renderMenuMgmtTab() {
  return ['unlimited', 'bar'].map(mk => `
    <div class="mgmt-block ${mk === 'bar' ? 'bar' : ''}">
      <h3>${counterLabel(mk)} Menu</h3>
      ${STATE.menus[mk].map((cat, ci) => `
        <div style="margin-bottom:14px;">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">
            <span>${cat.cat}</span>
            <button class="tiny-btn danger" data-del-cat="${mk}|${ci}">Remove category</button>
          </div>
          ${cat.items.map((it, ii) => `
            <div class="mgmt-row">
              ${it.image ? `<img class="mgmt-thumb" src="${it.image}" alt="">` : `<span class="mgmt-thumb-empty">🍽️</span>`}
              <input class="nm" value="${it.name}" data-edit="${mk}|${ci}|${ii}|name">
              <input class="pr" type="number" value="${it.price}" data-edit="${mk}|${ci}|${ii}|price">
              <label class="photo-label">📷 Photo<input type="file" accept="image/*" style="display:none;" data-upload="${mk}|${ci}|${ii}"></label>
              <button class="tiny-btn danger" data-del-item="${mk}|${ci}|${ii}">✕</button>
            </div>
          `).join('')}
          <div class="add-row">
            <input class="nm" placeholder="New item name" data-newname="${mk}|${ci}">
            <input class="pr" type="number" placeholder="Price" data-newprice="${mk}|${ci}">
            <button class="tiny-btn" data-add-item="${mk}|${ci}">+ Add</button>
          </div>
        </div>
      `).join('')}
      <div class="add-cat-form">
        <input placeholder="New category name" id="newcat-${mk}">
        <button class="tiny-btn" data-add-cat="${mk}">+ Add Category</button>
      </div>
    </div>
  `).join('');
}

function renderStaffAccessTab() {
  const users = STATE.users || {};
  return `
  <div class="mgmt-block">
    <h3>Staff Access — PINs</h3>
    <div class="user-row"><div class="rn">Admin</div><input type="text" value="${users.admin ? users.admin.pin : ''}" data-pin="admin"></div>
    <div class="user-row"><div class="rn">Unlimited Staff</div><input type="text" value="${users.staff ? users.staff.pin : ''}" data-pin="staff"></div>
    <div class="user-row"><div class="rn">Rhythm Bar</div><input type="text" value="${users.bar ? users.bar.pin : ''}" data-pin="bar"></div>
    <button class="tiny-btn" id="save-pins-btn" style="margin-top:12px;">Save PINs</button>
    <span id="pin-saved-msg" style="margin-left:10px;color:var(--free);font-size:12px;"></span>
  </div>`;
}

/* ================= ADMIN EVENTS ================= */
function attachAdminEvents() {
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('bar-orders-btn').addEventListener('click', openBarOrdersModal);
  startPolling();
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => { ADMIN_TAB = btn.dataset.tab; CART = []; renderAdminContent(); });
  });
  bindAdminTabEvents();
}

function renderAdminContent() {
  document.querySelector('.tabs').innerHTML = `
      <button class="tab-btn ${ADMIN_TAB === 'billing' ? 'active' : ''}" data-tab="billing">New Bill</button>
      <button class="tab-btn ${ADMIN_TAB === 'reports' ? 'active' : ''}" data-tab="reports">Reports</button>
      <button class="tab-btn ${ADMIN_TAB === 'menu' ? 'active' : ''}" data-tab="menu">Menu Management</button>
      <button class="tab-btn ${ADMIN_TAB === 'staff' ? 'active' : ''}" data-tab="staff">Staff Access</button>`;
  document.querySelector('.content').innerHTML = renderAdminTab();
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => { ADMIN_TAB = btn.dataset.tab; CART = []; renderAdminContent(); });
  });
  bindAdminTabEvents();
}

function bindAdminTabEvents() {
  if (ADMIN_TAB === 'billing') {
    const sel = document.getElementById('admin-counter-select');
    if (sel) sel.addEventListener('change', () => { ADMIN_BILL_COUNTER = sel.value; CART = []; renderAdminContent(); });
    bindBillingEvents(ADMIN_BILL_COUNTER, renderAdminContent);
  }
  if (ADMIN_TAB === 'reports') {
    renderReportsTab();
  }
  if (ADMIN_TAB === 'menu') {
  document.querySelectorAll('[data-edit]').forEach(inp => {
    inp.addEventListener('change', async () => {
      const [mk, ci, ii, field] = inp.dataset.edit.split('|');
      const it = STATE.menus[mk][Number(ci)].items[Number(ii)];

      it[field] = field === 'price' ? Number(inp.value) : inp.value;

      try {
        await api('/api/menu', {
          method: 'PUT',
          body: JSON.stringify({
            menus: STATE.menus
          })
        });
      } catch (e) {
        showToast('Save failed: ' + e.message);
      }
    });
  });

  document.querySelectorAll('[data-upload]').forEach(inp => {
    inp.addEventListener('change', async () => {
      const file = inp.files[0];
      if (!file) return;

      const [mk, ci, ii] = inp.dataset.upload.split('|');

      const fd = new FormData();
      fd.append('image', file);

      try {
        const res = await api('/api/upload', {
          method: 'POST',
          body: fd
        });

        STATE.menus[mk][Number(ci)].items[Number(ii)].image = res.url;

        await api('/api/menu', {
          method: 'PUT',
          body: JSON.stringify({
            menus: STATE.menus
          })
        });

        renderAdminContent();
      } catch (e) {
        showToast('Photo upload failed: ' + e.message);
      }
    });
  });

  document.querySelectorAll('[data-del-item]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [mk, ci, ii] = btn.dataset.delItem.split('|');

      STATE.menus[mk][Number(ci)].items.splice(
        Number(ii),
        1
      );

      await api('/api/menu', {
        method: 'PUT',
        body: JSON.stringify({
          menus: STATE.menus
        })
      });

      renderAdminContent();
    });
  });

  document.querySelectorAll('[data-del-cat]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [mk, ci] = btn.dataset.delCat.split('|');

      if (confirm('Remove this whole category?')) {
        STATE.menus[mk].splice(Number(ci), 1);

        await api('/api/menu', {
          method: 'PUT',
          body: JSON.stringify({
            menus: STATE.menus
          })
        });

        renderAdminContent();
      }
    });
  });

  document.querySelectorAll('[data-add-item]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const [mk, ci] = btn.dataset.addItem.split('|');

      const nameInp = document.querySelector(
        `[data-newname="${mk}|${ci}"]`
      );

      const priceInp = document.querySelector(
        `[data-newprice="${mk}|${ci}"]`
      );

      const name = nameInp.value.trim();
      if (!name) return;

      const price = Number(priceInp.value) || 0;

      STATE.menus[mk][Number(ci)].items.push({
        id:
          'm' +
          Date.now().toString(36) +
          Math.floor(Math.random() * 1000),
        name,
        price,
        image: null
      });

      await api('/api/menu', {
        method: 'PUT',
        body: JSON.stringify({
          menus: STATE.menus
        })
      });

      renderAdminContent();
    });
  });

  document.querySelectorAll('[data-add-cat]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mk = btn.dataset.addCat;

      const inp = document.getElementById(
        'newcat-' + mk
      );

      const name = inp.value.trim();
      if (!name) return;

      STATE.menus[mk].push({
        cat: name,
        items: []
      });

      await api('/api/menu', {
        method: 'PUT',
        body: JSON.stringify({
          menus: STATE.menus
        })
      });

      renderAdminContent();
    });
  });
}
  if (ADMIN_TAB === 'staff') {
    const saveBtn = document.getElementById('save-pins-btn');
    if (saveBtn) saveBtn.addEventListener('click', async () => {
      const pins = {};
      document.querySelectorAll('[data-pin]').forEach(inp => { pins[inp.dataset.pin] = inp.value.trim(); });
      try {
        await api('/api/users/pins', { method: 'PUT', body: JSON.stringify(pins) });
        document.getElementById('pin-saved-msg').textContent = 'Saved.';
        setTimeout(() => { const m = document.getElementById('pin-saved-msg'); if (m) m.textContent = ''; }, 2000);
      } catch (e) { showToast('Save failed: ' + e.message); }
    });
  }
}

/* ================= BOOT ================= */
boot();
