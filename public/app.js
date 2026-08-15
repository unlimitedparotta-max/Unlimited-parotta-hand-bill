/* =========================================================
   UNLIMITED PAROTTA × RHYTHM BAR
   Billing / Admin / Reports / Inventory / Menu / Staff
   ========================================================= */

/* ================= SESSION / STATE ================= */

let TOKEN = localStorage.getItem('up_token') || null;
let ROLE = localStorage.getItem('up_role') || null;
let LABEL = localStorage.getItem('up_label') || '';

let STATE = {
  menus: {
    unlimited: [],
    bar: []
  },
  billCounter: 1,
  users: null
};

let CART = [];
let CART_DRAWER_OPEN = false;

const PRINTED_KEY = 'up_printed_billnos';
const AUTOPRINT_KEY = 'up_autoprint';
const PAPERWIDTH_KEY = 'up_paperwidth';

let PRINTED_BILLNOS = new Set(
  JSON.parse(localStorage.getItem(PRINTED_KEY) || '[]')
);

let AUTO_PRINT =
  localStorage.getItem(AUTOPRINT_KEY) !== 'off';

let PENDING_BAR_ORDERS = [];
let BAR_ORDERS = [];
let BAR_STATUS_SNAPSHOT = new Map();
let POLL_TIMER = null;

let ADMIN_TAB = 'billing';
let ADMIN_BILL_COUNTER = 'unlimited';

let REPORT_FROM = todayStr();
let REPORT_TO = todayStr();
let ALL_ORDERS_CACHE = [];


/* ================= SHOP INFORMATION ================= */

const SHOP_INFO = {
  name: 'UNLIMITED PAROTTA',
  tagline: 'Taste Unlimited. Happiness Unlimited.',

  addressLines: [
    '14, Rani Paradise Theater Complex,',
    'Membalam Rd, Pandiyar Residency,',
    'Thanjavur, India, 613007'
  ],

  phone: '97895 22232',

  hoursLines: [
    '12.00 PM to 4.00 PM',
    '7.00 PM to 10.00 PM'
  ],

  reviewLink: ''
};

SHOP_INFO.address =
  SHOP_INFO.addressLines.join(' ');


/* ================= RECEIPT PAPER ================= */

let PAPER_WIDTH =
  localStorage.getItem(PAPERWIDTH_KEY) === '58'
    ? '58'
    : '80';

let RECEIPT_WIDTH =
  PAPER_WIDTH === '58'
    ? 32
    : 40;


function setPaperWidth(width) {

  PAPER_WIDTH =
    width === '58'
      ? '58'
      : '80';

  localStorage.setItem(
    PAPERWIDTH_KEY,
    PAPER_WIDTH
  );

  RECEIPT_WIDTH =
    PAPER_WIDTH === '58'
      ? 32
      : 40;

  applyThermalPageStyle();
}


function applyThermalPageStyle() {

  const tag =
    document.getElementById(
      'thermal-page-style'
    );

  if (!tag) return;

  const mm =
    PAPER_WIDTH === '58'
      ? 58
      : 80;

  const contentMm =
    PAPER_WIDTH === '58'
      ? 50
      : 72;

  tag.textContent = `
    @page {
      size: ${mm}mm auto;
      margin: 0;
    }

    @media print {

      #receipt-print {
        width: ${mm}mm;
      }

      .receipt-mono {
        width: ${contentMm}mm;
        font-size: ${PAPER_WIDTH === '58' ? '11px' : '12px'};
      }
    }
  `;
}


/* ================= FORMATTING ================= */

function padR(value, width) {

  value = String(value);

  return value.length >= width
    ? value
    : value + ' '.repeat(width - value.length);
}


function padL(value, width) {

  value = String(value);

  return value.length >= width
    ? value
    : ' '.repeat(width - value.length) + value;
}


function centerText(value, width) {

  value = String(value);

  if (value.length >= width) {
    return value;
  }

  const total =
    width - value.length;

  const left =
    Math.floor(total / 2);

  return (
    ' '.repeat(left) +
    value +
    ' '.repeat(total - left)
  );
}


function receiptDivider() {

  return '-'.repeat(
    RECEIPT_WIDTH
  );
}


function itemRow(
  name,
  qtyStr,
  amtStr
) {

  const NAME_W = 20;
  const QTY_W = 6;

  const AMT_W =
    RECEIPT_WIDTH -
    NAME_W -
    QTY_W;

  if (String(name).length > NAME_W) {

    return (
      padR(name, RECEIPT_WIDTH) +
      '\n' +
      padL(
        qtyStr,
        NAME_W + QTY_W
      ) +
      padL(
        amtStr,
        AMT_W
      )
    );
  }

  return (
    padR(name, NAME_W) +
    padL(qtyStr, QTY_W) +
    padL(amtStr, AMT_W)
  );
}


function pad0(number, width = 2) {

  return String(number)
    .padStart(width, '0');
}


/* ================= BILL NUMBER ================= */

function formatBillCode(order) {

  const d =
    new Date(order.time);

  const prefix =
    order.menuKey === 'bar'
      ? 'RB'
      : 'UPB';

  return (
    prefix +
    pad0(d.getFullYear() % 100) +
    pad0(d.getMonth() + 1) +
    pad0(d.getDate()) +
    pad0(order.billNo, 4)
  );
}


function billDateStr(iso) {

  const d =
    new Date(iso);

  return (
    pad0(d.getDate()) +
    '-' +
    pad0(d.getMonth() + 1) +
    '-' +
    d.getFullYear()
  );
}


function billTimeStr(iso) {

  const d =
    new Date(iso);

  let hours =
    d.getHours();

  const minutes =
    pad0(d.getMinutes());

  const ap =
    hours >= 12
      ? 'PM'
      : 'AM';

  hours =
    hours % 12;

  if (hours === 0) {
    hours = 12;
  }

  return (
    pad0(hours) +
    ':' +
    minutes +
    ' ' +
    ap
  );
}


const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];


function billDateTimeStr(iso) {

  const d =
    new Date(iso);

  return (
    pad0(d.getDate()) +
    ' ' +
    MONTH_SHORT[d.getMonth()] +
    ' ' +
    d.getFullYear() +
    ', ' +
    billTimeStr(iso)
  );
}


function billDateHuman(iso) {

  const d =
    new Date(iso);

  return (
    pad0(d.getDate()) +
    ' ' +
    MONTH_SHORT[d.getMonth()] +
    ' ' +
    d.getFullYear()
  );
}


function escapeHtml(value) {

  return String(value ?? '')
    .replace(
      /[&<>"']/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character])
    );
}


/* ================= NUMBER TO WORDS ================= */

function numberToWordsIndian(number) {

  number =
    Math.round(
      Number(number) || 0
    );

  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen'
  ];

  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety'
  ];


  function twoDigits(n) {

    if (n < 20) {
      return ones[n];
    }

    return (
      tens[Math.floor(n / 10)] +
      (
        n % 10
          ? ' ' + ones[n % 10]
          : ''
      )
    );
  }


  function threeDigits(n) {

    let result = '';

    if (n >= 100) {

      result +=
        ones[Math.floor(n / 100)] +
        ' Hundred';

      n %= 100;

      if (n) {
        result += ' ';
      }
    }

    if (n) {
      result += twoDigits(n);
    }

    return result;
  }


  if (number === 0) {
    return 'Zero';
  }


  const crore =
    Math.floor(
      number / 10000000
    );

  number %= 10000000;


  const lakh =
    Math.floor(
      number / 100000
    );

  number %= 100000;


  const thousand =
    Math.floor(
      number / 1000
    );

  number %= 1000;


  const rest =
    number;


  const parts = [];


  if (crore) {
    parts.push(
      threeDigits(crore) +
      ' Crore'
    );
  }


  if (lakh) {
    parts.push(
      threeDigits(lakh) +
      ' Lakh'
    );
  }


  if (thousand) {
    parts.push(
      threeDigits(thousand) +
      ' Thousand'
    );
  }


  if (rest) {
    parts.push(
      threeDigits(rest)
    );
  }


  return parts.join(' ');
}


function amountInWords(amount) {

  return (
    'Rupees ' +
    numberToWordsIndian(amount) +
    ' Only'
  );
}


/* ================= GENERAL HELPERS ================= */

function rupee(number) {

  return (
    '₹' +
    Number(number || 0)
      .toFixed(0)
  );
}


function todayStr(date) {

  const dt =
    date
      ? new Date(date)
      : new Date();

  return new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }
  ).format(dt);
}


function niceDateTime(iso) {

  const d =
    new Date(iso);

  return d.toLocaleString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  );
}


function counterLabel(key) {

  return key === 'unlimited'
    ? 'Unlimited Parotta'
    : 'Rhythm Bar';
}


function cartTotal() {

  return CART.reduce(
    (total, line) =>
      total +
      (
        Number(line.price || 0) *
        Number(line.qty || 0)
      ),
    0
  );
}


function showToast(message) {

  const root =
    document.getElementById(
      'modal-root'
    );

  if (!root) return;

  const div =
    document.createElement('div');

  div.className =
    'toast';

  div.textContent =
    message;

  root.appendChild(div);

  setTimeout(
    () => div.remove(),
    3200
  );
}


function beep() {

  try {

    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) return;

    const ctx =
      new AudioContext();

    const oscillator =
      ctx.createOscillator();

    const gain =
      ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.frequency.value =
      880;

    gain.gain.value =
      0.15;

    oscillator.start();

    setTimeout(
      () => {
        oscillator.stop();
        ctx.close();
      },
      220
    );

  } catch (error) {
    console.warn(
      'Audio notification unavailable:',
      error
    );
  }
}


/* ================= API ================= */

async function api(
  path,
  opts = {}
) {

  const headers =
    opts.headers
      ? { ...opts.headers }
      : {};

  if (TOKEN) {
    headers['X-Token'] =
      TOKEN;
  }

  if (
    !(opts.body instanceof FormData) &&
    opts.body
  ) {
    headers['Content-Type'] =
      'application/json';
  }

  const response =
    await fetch(
      path,
      {
        ...opts,
        headers
      }
    );


  if (response.status === 401) {

    console.error(
      'AUTH 401:',
      {
        path,
        tokenExists: !!TOKEN,
        role: ROLE
      }
    );

    doLocalLogout();

    render();

    throw new Error(
      'Session expired — please log in again.'
    );
  }


  const data =
    await response
      .json()
      .catch(() => ({}));


  if (!response.ok) {

    throw new Error(
      data.error ||
      'Request failed'
    );
  }


  return data;
}


/* ================= PRINT TRACKING ================= */

function markPrinted(billNo) {

  PRINTED_BILLNOS.add(
    Number(billNo)
  );

  localStorage.setItem(
    PRINTED_KEY,
    JSON.stringify(
      Array.from(
        PRINTED_BILLNOS
      ).slice(-300)
    )
  );
}


/* ================= PAY LINK ================= */

function buildPayLink(order) {

  return (
    window.location.origin +
    '/pay/' +
    order.billNo
  );
}


/* ================= BOOT / LOGIN ================= */

function doLocalLogout() {

  TOKEN = null;
  ROLE = null;
  LABEL = '';

  localStorage.removeItem(
    'up_token'
  );

  localStorage.removeItem(
    'up_role'
  );

  localStorage.removeItem(
    'up_label'
  );

  CART = [];

  CART_DRAWER_OPEN = false;

  if (POLL_TIMER) {

    clearInterval(
      POLL_TIMER
    );

    POLL_TIMER = null;
  }
}


async function logout() {

  try {

    await api(
      '/api/logout',
      {
        method: 'POST'
      }
    );

  } catch (error) {

    console.warn(
      'Logout API error:',
      error
    );
  }

  doLocalLogout();

  render();
}


async function boot() {

  if (TOKEN && ROLE) {

    try {

      await loadState();

      render();

      return;

    } catch (error) {

      console.warn(
        'Session restore failed:',
        error
      );

      doLocalLogout();
    }
  }

  render();
}


async function loadState() {

  const data =
    await api(
      '/api/state'
    );

  STATE.menus =
    data.menus || {
      unlimited: [],
      bar: []
    };

  STATE.billCounter =
    data.billCounter || 1;

  STATE.users =
    data.users || null;
}


/* ================= MAIN RENDER ================= */

function render() {

  const app =
    document.getElementById(
      'app'
    );

  if (!app) return;


  if (!ROLE) {

    app.innerHTML =
      renderLogin();

    attachLoginEvents();

    return;
  }


  if (ROLE === 'admin') {

    app.innerHTML =
      renderAdminShell();

    attachAdminEvents();

    return;
  }


  const menuKey =
    ROLE === 'staff'
      ? 'unlimited'
      : 'bar';


  app.innerHTML =
    renderStaffShell(
      menuKey
    );

  attachStaffEvents(
    menuKey
  );
}


/* ================= LOGIN ================= */

function renderLogin() {

  return `
    <div class="login-wrap">

      <div class="login-card">

        <div class="brand-row">

          <h1>
            UNLIMITED PAROTTA
          </h1>

          <span class="brand-x">
            &times;
          </span>

          <h1 class="gold">
            RHYTHM BAR
          </h1>

        </div>

        <div class="tagline">
          Billing &amp; Counter System
        </div>


        <div class="role-grid">


          <div class="role-card admin">

            <span class="icon">
              🗝️
            </span>

            <h3>
              Admin
            </h3>

            <p>
              Full access — both counters,
              reports, menu &amp; staff settings
            </p>

            <input
              type="password"
              id="pin-admin"
              placeholder="PIN"
            >

            <button
              class="btn"
              data-role="admin"
            >
              Login as Admin
            </button>

          </div>


          <div class="role-card">

            <span class="icon">
              🫓
            </span>

            <h3>
              Unlimited Staff
            </h3>

            <p>
              Billing counter for the
              parotta &amp; egg menu
              (ground floor)
            </p>

            <input
              type="password"
              id="pin-staff"
              placeholder="PIN"
            >

            <button
              class="btn"
              data-role="staff"
            >
              Login as Staff
            </button>

          </div>


          <div class="role-card bar">

            <span class="icon">
              🍸
            </span>

            <h3>
              Rhythm Bar
            </h3>

            <p>
              Billing counter for the
              bar &amp; starters menu
              (1st floor)
            </p>

            <input
              type="password"
              id="pin-bar"
              placeholder="PIN"
            >

            <button
              class="btn"
              data-role="bar"
            >
              Login to Rhythm
            </button>

          </div>


        </div>


        <div
          class="login-err"
          id="login-err"
        ></div>

      </div>

    </div>
  `;
}


function attachLoginEvents() {

  document
    .querySelectorAll(
      '.role-card .btn'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        async () => {

          const role =
            button.dataset.role;

          const input =
            document.getElementById(
              'pin-' + role
            );

          const pin =
            input
              ? input.value.trim()
              : '';

          const errorBox =
            document.getElementById(
              'login-err'
            );

          button.disabled = true;

          button.textContent =
            'Checking…';


          try {

            const data =
              await api(
                '/api/login',
                {
                  method: 'POST',
                  body: JSON.stringify({
                    role,
                    pin
                  })
                }
              );


            TOKEN =
              data.token;

            ROLE =
              data.role;

            LABEL =
              data.label;


            localStorage.setItem(
              'up_token',
              TOKEN
            );

            localStorage.setItem(
              'up_role',
              ROLE
            );

            localStorage.setItem(
              'up_label',
              LABEL
            );


            await loadState();

            CART = [];

            errorBox.textContent =
              '';

            render();


          } catch (error) {

            errorBox.textContent =
              error.message ||
              'Incorrect PIN.';

            button.disabled =
              false;

            button.textContent =
              role === 'admin'
                ? 'Login as Admin'
                : role === 'bar'
                  ? 'Login to Rhythm'
                  : 'Login as Staff';
          }

        }
      );
    });


  document
    .querySelectorAll(
      '.role-card input[type=password]'
    )
    .forEach(input => {

      input.addEventListener(
        'keydown',
        event => {

          if (
            event.key === 'Enter'
          ) {

            input
              .nextElementSibling
              ?.click();
          }
        }
      );

    });
}


/* =========================================================
   STAFF BILLING
   ========================================================= */

function renderStaffShell(
  menuKey
) {

  const isBar =
    menuKey === 'bar';


  return `
    <div class="shell">

      <div class="topbar ${isBar ? 'bar' : ''}">

        <div class="who">

          <span class="dot"></span>

          <h2>
            ${counterLabel(menuKey)}
            — Billing
          </h2>

        </div>


        <div class="topbar-actions">


          ${
            menuKey === 'unlimited'
              ? `
                <button
                  class="sync-badge"
                  id="bar-orders-btn"
                >
                  🔔 Bar orders
                  ${
                    PENDING_BAR_ORDERS.length
                      ? `
                        <span class="cnt">
                          ${PENDING_BAR_ORDERS.length}
                        </span>
                      `
                      : ''
                  }
                </button>
              `
              : ''
          }


          ${
            menuKey === 'bar'
              ? `
                <button
                  class="sync-badge"
                  id="bar-status-btn"
                >
                  🔔 Order status
                  ${
                    BAR_ORDERS.filter(
                      order =>
                        (order.status || 'new') ===
                        'ready'
                    ).length
                      ? `
                        <span class="cnt">
                          ${
                            BAR_ORDERS.filter(
                              order =>
                                (order.status || 'new') ===
                                'ready'
                            ).length
                          }
                        </span>
                      `
                      : ''
                  }
                </button>
              `
              : ''
          }


          <span class="pill-btn">
            ${escapeHtml(LABEL)}
          </span>


          <button
            class="pill-btn logout"
            id="logout-btn"
          >
            Log out
          </button>


        </div>

      </div>


      <div class="content">
        ${renderBillingArea(menuKey)}
      </div>

    </div>
  `;
}


function renderBillingArea(
  menuKey
) {

  const categories =
    STATE.menus[menuKey] || [];


  return `
    <div class="bill-layout">


      <div class="menu-col">

        ${
          categories.length
            ? categories.map(category => `

              <div class="cat-block">

                <h3>
                  ${escapeHtml(category.cat)}

                  <span class="rule"></span>
                </h3>


                <div class="item-grid">

                  ${
                    (category.items || [])
                      .map(item => {

                        const inCart =
                          CART.find(
                            line =>
                              line.id === item.id
                          );

                        const isFree =
                          Number(item.price) === 0;


                        return `
                          <button
                            class="item-btn ${isFree ? 'free' : ''}"
                            data-id="${escapeHtml(item.id)}"
                            data-menu="${menuKey}"
                          >

                            ${
                              inCart
                                ? `
                                  <span class="qtybadge">
                                    ${inCart.qty}
                                  </span>
                                `
                                : ''
                            }


                            ${
                              item.image
                                ? `
                                  <img
                                    class="thumb"
                                    src="${escapeHtml(item.image)}"
                                    alt=""
                                  >
                                `
                                : `
                                  <span class="thumb-placeholder">
                                    🍽️
                                  </span>
                                `
                            }


                            <span class="body">

                              <span class="nm">
                                ${escapeHtml(item.name)}
                              </span>


                              <span class="pricerow">

                                <span class="leader"></span>

                                <span class="pr">
                                  ${
                                    isFree
                                      ? 'FREE'
                                      : rupee(item.price)
                                  }
                                </span>

                              </span>

                            </span>

                          </button>
                        `;

                      })
                      .join('')
                  }

                </div>

              </div>

            `).join('')
            : `
              <div class="mgmt-block">
                <h3>
                  No menu items
                </h3>

                <p>
                  Add menu items from
                  Admin → Menu Management.
                </p>
              </div>
            `
        }

      </div>


      <div
        class="cart ${CART_DRAWER_OPEN ? 'open' : ''}"
      >

        <div
          class="cart-close-btn"
          id="cart-close-btn"
        >
          Close ✕
        </div>


        <h3>
          Current Order
        </h3>


        <div id="cart-lines">
          ${renderCartLines()}
        </div>


        <div class="cart-total">

          <span>
            Total
          </span>

          <span id="cart-total-val">
            ${rupee(cartTotal())}
          </span>

        </div>


        <div class="paper-width-row">

          <span>
            🖨️ Receipt paper
          </span>

          <select
            id="paper-width-select"
          >

            <option
              value="80"
              ${
                PAPER_WIDTH === '80'
                  ? 'selected'
                  : ''
              }
            >
              80mm
            </option>

            <option
              value="58"
              ${
                PAPER_WIDTH === '58'
                  ? 'selected'
                  : ''
              }
            >
              58mm
            </option>

          </select>

        </div>


        <div class="field">

          <label>
            Table / Token (optional)
          </label>

          <input
            type="text"
            id="order-note"
            placeholder="e.g. Table 4 / Parcel"
          >

        </div>


        ${
          ROLE !== 'bar'
            ? `

              <div class="field">

                <label>
                  Customer Name (optional)
                </label>

                <input
                  type="text"
                  id="customer-name"
                  placeholder="e.g. Mr. Kavin Dharan"
                >

              </div>


              <div class="field">

                <label>
                  Customer Mobile Number (optional)
                </label>

                <input
                  type="tel"
                  id="customer-mobile"
                  placeholder="e.g. 9876543210"
                  inputmode="numeric"
                  maxlength="10"
                >

              </div>

            `
            : ''
        }


        <button
          class="checkout-btn"
          id="checkout-btn"
          ${CART.length ? '' : 'disabled'}
        >
          ${checkoutBtnLabel()}
        </button>


        <button
          class="clear-btn"
          id="clear-cart-btn"
        >
          Clear order
        </button>

      </div>

    </div>


    <div
      class="mobile-cart-bar ${menuKey === 'bar' ? 'gold' : ''}"
      id="mobile-cart-bar"
    >

      <span>

        🛒 ${CART.length}
        item${CART.length === 1 ? '' : 's'}

        <span class="mc-sub">
          Tap to view order
        </span>

      </span>


      <span>
        ${rupee(cartTotal())}
      </span>

    </div>
  `;
}


function checkoutBtnLabel() {

  return ROLE === 'bar'
    ? 'Send Order & Save'
    : 'Print Bill & Save';
}


function renderCartLines() {

  if (!CART.length) {

    return `
      <div class="cart-empty">
        No items yet —
        tap a menu item to add it.
      </div>
    `;
  }


  return CART.map(line => `

    <div class="cart-line">


      <div class="nm">

        ${escapeHtml(line.name)}

        <small>
          ${
            Number(line.price) === 0
              ? 'FREE'
              : rupee(line.price) +
                ' each'
          }
        </small>

      </div>


      <div class="qty-ctl">

        <button
          data-act="dec"
          data-id="${escapeHtml(line.id)}"
        >
          −
        </button>

        <span>
          ${line.qty}
        </span>

        <button
          data-act="inc"
          data-id="${escapeHtml(line.id)}"
        >
          +
        </button>

      </div>


      <div class="lt">
        ${rupee(
          Number(line.price) *
          Number(line.qty)
        )}
      </div>


      <button
        class="rm"
        data-act="rm"
        data-id="${escapeHtml(line.id)}"
      >
        ✕
      </button>

    </div>

  `).join('');
}


/* ================= BILLING EVENTS ================= */

function attachStaffEvents(
  menuKey
) {

  document
    .getElementById('logout-btn')
    ?.addEventListener(
      'click',
      logout
    );


  document
    .getElementById('bar-orders-btn')
    ?.addEventListener(
      'click',
      openBarOrdersModal
    );


  document
    .getElementById('bar-status-btn')
    ?.addEventListener(
      'click',
      openBarOrdersModal
    );


  startPolling();

  bindBillingEvents(
    menuKey
  );
}


function bindBillingEvents(
  menuKey,
  refreshFn
) {

  const refresh =
    refreshFn ||
    (() =>
      refreshBillingArea(menuKey));


  document
    .querySelectorAll('.item-btn')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const id =
            button.dataset.id;

          const menu =
            button.dataset.menu;

          const allItems =
            (
              STATE.menus[menu] || []
            )
              .flatMap(
                category =>
                  category.items || []
              );


          const item =
            allItems.find(
              entry =>
                String(entry.id) ===
                String(id)
            );


          if (!item) {

            showToast(
              'Menu item not found.'
            );

            return;
          }


          const existing =
            CART.find(
              line =>
                String(line.id) ===
                String(id)
            );


          if (existing) {

            existing.qty++;

          } else {

            CART.push({
              id: item.id,
              name: item.name,
              price: Number(item.price) || 0,
              qty: 1
            });
          }


          refresh();
        }
      );

    });


  document
    .getElementById('checkout-btn')
    ?.addEventListener(
      'click',
      () =>
        checkout(
          menuKey,
          refresh
        )
    );


  document
    .getElementById('clear-cart-btn')
    ?.addEventListener(
      'click',
      () => {

        CART = [];

        refresh();
      }
    );


  document
    .querySelectorAll(
      '.qty-ctl button, .rm'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const id =
            button.dataset.id;

          const action =
            button.dataset.act;

          const line =
            CART.find(
              entry =>
                String(entry.id) ===
                String(id)
            );


          if (!line) return;


          if (
            action === 'inc'
          ) {

            line.qty++;

          } else if (
            action === 'dec'
          ) {

            line.qty--;

            if (line.qty <= 0) {

              CART =
                CART.filter(
                  entry =>
                    String(entry.id) !==
                    String(id)
                );
            }

          } else if (
            action === 'rm'
          ) {

            CART =
              CART.filter(
                entry =>
                  String(entry.id) !==
                  String(id)
              );
          }


          refresh();
        }
      );

    });


  document
    .getElementById('mobile-cart-bar')
    ?.addEventListener(
      'click',
      () => {

        CART_DRAWER_OPEN = true;

        refresh();
      }
    );


  document
    .getElementById('cart-close-btn')
    ?.addEventListener(
      'click',
      () => {

        CART_DRAWER_OPEN = false;

        refresh();
      }
    );


  document
    .getElementById('paper-width-select')
    ?.addEventListener(
      'change',
      event => {

        setPaperWidth(
          event.target.value
        );

        showToast(
          `Receipt paper set to ${event.target.value}mm`
        );
      }
    );
}


function refreshBillingArea(
  menuKey
) {

  const content =
    document.querySelector(
      '.content'
    );

  if (!content) return;

  content.innerHTML =
    renderBillingArea(
      menuKey
    );

  bindBillingEvents(
    menuKey
  );
}


/* ================= CHECKOUT ================= */

async function checkout(
  menuKey,
  refreshFn
) {

  if (!CART.length) return;


  const refresh =
    refreshFn ||
    (() =>
      refreshBillingArea(menuKey));


  const note =
    document
      .getElementById(
        'order-note'
      )
      ?.value
      .trim() || '';


  const items =
    CART.map(line => ({
      id: line.id,
      name: line.name,
      price: Number(line.price) || 0,
      qty: Number(line.qty) || 0
    }));


  let customerMobile = '';
  let customerName = '';


  if (ROLE !== 'bar') {

    customerName =
      document
        .getElementById(
          'customer-name'
        )
        ?.value
        .trim() || '';


    customerMobile =
      (
        document
          .getElementById(
            'customer-mobile'
          )
          ?.value || ''
      )
        .replace(/\D/g, '')
        .slice(0, 10);
  }


  const checkoutBtn =
    document.getElementById(
      'checkout-btn'
    );


  if (checkoutBtn) {

    checkoutBtn.disabled =
      true;

    checkoutBtn.textContent =
      'Saving…';
  }


  const context = {
    menuKey,
    items,
    note,
    customerName,
    customerMobile,
    refresh
  };


  if (ROLE === 'bar') {

    await submitOrder(
      context,
      'cash'
    );

    return;
  }


  openPaymentModal(
    context
  );
}


function resetCheckoutBtn() {

  const button =
    document.getElementById(
      'checkout-btn'
    );

  if (!button) return;

  button.disabled =
    false;

  button.textContent =
    checkoutBtnLabel();
}


async function submitOrder(
  context,
  paymentMethod
) {

  try {

    const data =
      await api(
        '/api/orders',
        {
          method: 'POST',

          body:
            JSON.stringify({
              menuKey:
                context.menuKey,

              items:
                context.items,

              note:
                context.note,

              customerMobile:
                context.customerMobile,

              customerName:
                context.customerName,

              paymentMethod
            })
        }
      );


    if (!data.order) {

      throw new Error(
        'Server did not return the saved order.'
      );
    }


    await finishCheckout(
      data.order,
      context.menuKey,
      context.customerMobile,
      context.refresh
    );


  } catch (error) {

    console.error(
      'Checkout error:',
      error
    );

    showToast(
      'Could not save order: ' +
      error.message
    );

    resetCheckoutBtn();
  }
}


/* ================= PAYMENT MODAL ================= */

function openPaymentModal(
  context
) {

  const root =
    document.getElementById(
      'modal-root'
    );

  if (!root) return;


  root.innerHTML = `

    <div
      class="modal-overlay"
      id="pay-modal-overlay"
    >

      <div
        class="modal-box"
        style="text-align:center;"
      >

        <h3>
          How is the customer paying?
        </h3>

        <p>
          Order total:
          <strong>
            ${rupee(cartTotal())}
          </strong>
        </p>


        <div
          style="
            display:flex;
            gap:10px;
            margin:14px 0;
          "
        >

          <button
            class="checkout-btn pay-cash"
            id="pay-cash-btn"
            style="flex:1;"
          >
            💵 Cash
          </button>


          <button
            class="checkout-btn pay-gpay"
            id="pay-gpay-btn"
            style="flex:1;"
          >
            📲 GPay
          </button>

        </div>


        <button
          class="modal-close"
          id="pay-modal-cancel"
        >
          Cancel
        </button>

      </div>

    </div>
  `;


  const cancel =
    () => {

      closeModal();

      resetCheckoutBtn();
    };


  document
    .getElementById(
      'pay-modal-overlay'
    )
    ?.addEventListener(
      'click',
      event => {

        if (
          event.target.id ===
          'pay-modal-overlay'
        ) {
          cancel();
        }
      }
    );


  document
    .getElementById(
      'pay-modal-cancel'
    )
    ?.addEventListener(
      'click',
      cancel
    );


  document
    .getElementById(
      'pay-cash-btn'
    )
    ?.addEventListener(
      'click',
      () => {

        closeModal();

        submitOrder(
          context,
          'cash'
        );
      }
    );


  document
    .getElementById(
      'pay-gpay-btn'
    )
    ?.addEventListener(
      'click',
      () => {

        closeModal();

        submitOrder(
          context,
          'gpay'
        );
      }
    );
}


/* ================= FINISH CHECKOUT ================= */

async function finishCheckout(
  order,
  menuKey,
  customerMobile,
  refresh
) {

  if (
    menuKey === 'bar'
  ) {

    markPrinted(
      order.billNo
    );
  }


  if (ROLE === 'bar') {

    showToast(
      'Order sent to ground floor for printing.'
    );

  } else {

    printReceipt(
      order
    );
  }


  CART = [];

  CART_DRAWER_OPEN =
    false;


  if (typeof refresh === 'function') {

    refresh();
  }
}


/* =========================================================
   RECEIPT PRINTING
   ========================================================= */

function infoRow(
  label,
  value
) {

  return `
    <div class="r-row">

      <span class="r-label">
        ${escapeHtml(label)}
      </span>

      <span class="r-value">
        ${escapeHtml(value)}
      </span>

    </div>
  `;
}


function printReceipt(
  order
) {

  const receipt =
    document.getElementById(
      'receipt-print'
    );

  if (!receipt) {

    showToast(
      'Receipt print area not found.'
    );

    return;
  }


  let html = '';


  html += `
    <div class="r-shop">
      ${escapeHtml(SHOP_INFO.name)}
    </div>
  `;


  if (SHOP_INFO.tagline) {

    html += `
      <div class="r-tagline">
        ${escapeHtml(
          SHOP_INFO.tagline
        )}
      </div>
    `;
  }


  html += `
    <div class="r-div"></div>
  `;


  SHOP_INFO.addressLines
    .forEach(line => {

      html += `
        <div class="r-addr">
          ${escapeHtml(line)}
        </div>
      `;
    });


  if (SHOP_INFO.phone) {

    html += `
      <div class="r-addr">
        Ph: +91
        ${escapeHtml(
          SHOP_INFO.phone
        )}
      </div>
    `;
  }


  html += `
    <div class="r-div"></div>

    <div class="r-title">
      BILL
    </div>
  `;


  html += infoRow(
    'Bill No',
    '#' + order.billNo
  );


  html += infoRow(
    'Date',
    billDateHuman(
      order.time
    )
  );


  html += infoRow(
    'Time',
    billTimeStr(
      order.time
    )
  );


  html += infoRow(
    'Table/Token',
    order.note || '-'
  );


  html += infoRow(
    'Cashier',
    order.servedBy || '-'
  );


  html += infoRow(
    'Payment',
    order.paymentMethod === 'gpay'
      ? 'GPay / UPI'
      : 'Cash'
  );


  html += `
    <div class="r-div"></div>
  `;


  if (
    order.customerName ||
    order.customerMobile
  ) {

    if (order.customerName) {

      html += infoRow(
        'Customer',
        order.customerName
      );
    }


    if (order.customerMobile) {

      html += infoRow(
        'Mobile',
        '+91 ' +
        order.customerMobile
      );
    }


    html += `
      <div class="r-div"></div>
    `;
  }


  html += `
    <div class="r-item r-item-head">

      <span class="r-iname">
        Item
      </span>

      <span class="r-iqty">
        Qty
      </span>

      <span class="r-iamt">
        Amount
      </span>

    </div>

    <div class="r-div"></div>
  `;


  (
    order.items || []
  ).forEach(item => {

    const amount =
      Number(item.price) === 0
        ? 'FREE'
        : rupee(
            Number(item.price) *
            Number(item.qty)
          );


    html += `
      <div class="r-item">

        <span class="r-iname">
          ${escapeHtml(
            item.name
          )}
        </span>

        <span class="r-iqty">
          ${Number(item.qty)}
        </span>

        <span class="r-iamt">
          ${amount}
        </span>

      </div>
    `;
  });


  html += `
    <div class="r-div"></div>

    <div class="r-row">

      <span>
        Subtotal
      </span>

      <span>
        ${rupee(order.total)}
      </span>

    </div>

    <div class="r-div"></div>

    <div class="r-row r-total">

      <span>
        GRAND TOTAL
      </span>

      <span>
        ${rupee(order.total)}
      </span>

    </div>

    <div class="r-div"></div>

    <div class="r-words">
      (${escapeHtml(
        amountInWords(
          order.total
        )
      )})
    </div>

    <div class="r-div"></div>

    <div class="r-thanks">
      Thank You! Visit Again!
    </div>

    <div class="r-small">
      OPENING HOURS:
    </div>
  `;


  SHOP_INFO.hoursLines
    .forEach(hour => {

      html += `
        <div class="r-small">
          ${escapeHtml(hour)}
        </div>
      `;
    });


  html += `
    <div class="r-small">
      DINE IN |
      TAKE AWAY |
      HOME DELIVERY
    </div>
  `;


  receipt.innerHTML =
    `<div class="receipt-mono">${html}</div>`;


  markPrinted(
    order.billNo
  );


  setTimeout(
    () => window.print(),
    150
  );
}


/* =========================================================
   BAR ORDER SYNC
   ========================================================= */

function orderStatusLabel(
  status
) {

  return (
    {
      new: '🟠 NEW ORDER',
      accepted: '🟡 ACCEPTED',
      preparing: '🔵 PREPARING',
      ready: '🟢 ORDER READY',
      completed: '⚪ COMPLETED'
    }[status || 'new'] ||
    String(
      status || 'NEW'
    ).toUpperCase()
  );
}


function orderStatusClass(
  status
) {

  return (
    {
      new: 'new',
      accepted: 'accepted',
      preparing: 'preparing',
      ready: 'ready',
      completed: 'completed'
    }[status || 'new'] ||
    'new'
  );
}


function nextOrderAction(
  status
) {

  return (
    {
      new: 'ACCEPT',
      accepted: 'START PREPARING',
      preparing: 'MARK READY'
    }[status || 'new'] ||
    null
  );
}


function activeBarOrders() {

  return BAR_ORDERS.filter(
    order =>
      (order.status || 'new') !==
      'completed'
  );
}


async function updateBarOrderStatus(
  billNo,
  status
) {

  try {

    await api(
      `/api/orders/${billNo}/status`,
      {
        method: 'PUT',

        body:
          JSON.stringify({
            status
          })
      }
    );


    await pollBarOrders();

    openBarOrdersModal();


  } catch (error) {

    showToast(
      'Could not update order: ' +
      error.message
    );
  }
}


function startPolling() {

  if (POLL_TIMER) return;

  POLL_TIMER =
    setInterval(
      pollBarOrders,
      5000
    );

  pollBarOrders();
}


async function pollBarOrders() {

  try {

    const data =
      await api(
        '/api/orders?menuKey=bar&limit=50'
      );


    const orders =
      (data.orders || [])
        .map(order => ({
          ...order,
          status:
            order.status || 'new'
        }));


    const previous =
      BAR_STATUS_SNAPSHOT;


    BAR_ORDERS =
      orders;


    if (
      ROLE === 'staff' ||
      ROLE === 'admin'
    ) {

      const fresh =
        orders.filter(
          order =>
            order.status === 'new' &&
            !PRINTED_BILLNOS.has(
              order.billNo
            ) &&
            !PENDING_BAR_ORDERS.find(
              pending =>
                pending.billNo ===
                order.billNo
            )
        );


      if (fresh.length) {

        PENDING_BAR_ORDERS =
          PENDING_BAR_ORDERS.concat(
            fresh
          );

        beep();


        if (AUTO_PRINT) {

          fresh.forEach(
            order => {

              printReceipt(
                order
              );

              markPrinted(
                order.billNo
              );
            }
          );


          PENDING_BAR_ORDERS =
            PENDING_BAR_ORDERS.filter(
              pending =>
                !fresh.find(
                  order =>
                    order.billNo ===
                    pending.billNo
                )
            );
        }
      }


      refreshTopbarBadge();
    }


    if (ROLE === 'bar') {

      const becameReady =
        orders.some(
          order =>
            order.status === 'ready' &&
            previous.get(
              order.billNo
            ) &&
            previous.get(
              order.billNo
            ) !== 'ready'
        );


      if (becameReady) {

        beep();


        const ready =
          orders.filter(
            order =>
              order.status === 'ready' &&
              previous.get(
                order.billNo
              ) !== 'ready'
          );


        ready.forEach(
          order => {

            showToast(
              `🟢 Order ${formatBillCode(order)} is READY — collect from ground floor.`
            );
          }
        );
      }


      refreshBarStatusBadge();
    }


    BAR_STATUS_SNAPSHOT =
      new Map(
        orders.map(
          order => [
            order.billNo,
            order.status
          ]
        )
      );


  } catch (error) {

    /*
      Polling failures are intentionally
      silent. The next polling cycle
      will retry.
    */

    console.warn(
      'Bar order polling failed:',
      error.message
    );
  }
}


function refreshTopbarBadge() {

  const button =
    document.getElementById(
      'bar-orders-btn'
    );

  if (!button) return;


  const count =
    BAR_ORDERS.filter(
      order =>
        (order.status || 'new') ===
        'new'
    ).length;


  button.innerHTML =
    `
      🔔 Bar orders
      ${
        count
          ? `
            <span class="cnt">
              ${count}
            </span>
          `
          : ''
      }
    `;
}


function refreshBarStatusBadge() {

  const button =
    document.getElementById(
      'bar-status-btn'
    );

  if (!button) return;


  const count =
    BAR_ORDERS.filter(
      order =>
        (order.status || 'new') ===
        'ready'
    ).length;


  button.innerHTML =
    `
      🔔 Order status
      ${
        count
          ? `
            <span class="cnt">
              ${count}
            </span>
          `
          : ''
      }
    `;
}


/* ================= BAR ORDERS MODAL ================= */

function openBarOrdersModal() {

  const root =
    document.getElementById(
      'modal-root'
    );

  if (!root) return;


  const isBar =
    ROLE === 'bar';


  const orders =
    activeBarOrders()
      .slice()
      .reverse();


  root.innerHTML = `

    <div
      class="modal-overlay"
      id="modal-overlay"
    >

      <div class="modal-box">

        <h3>
          ${
            isBar
              ? 'Rhythm Bar — Order Status'
              : 'Incoming Bar Orders'
          }
        </h3>


        <p>
          ${
            isBar
              ? 'Track every order sent to the ground floor.'
              : 'Orders placed upstairs at Rhythm Bar. Accept, prepare and mark them READY.'
          }
        </p>


        ${
          !isBar
            ? `
              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                  padding:8px 0;
                  border-bottom:1px solid var(--line);
                  margin-bottom:10px;
                "
              >

                <span>
                  Auto-print incoming orders
                </span>

                <input
                  type="checkbox"
                  id="autoprint-toggle"
                  ${AUTO_PRINT ? 'checked' : ''}
                >

              </div>
            `
            : ''
        }


        ${
          orders.length
            ? orders.map(order => {

                const status =
                  order.status || 'new';


                const action =
                  !isBar
                    ? nextOrderAction(
                        status
                      )
                    : status === 'ready'
                      ? 'MARK COLLECTED'
                      : null;


                const nextStatus =
                  !isBar
                    ? (
                        {
                          new: 'accepted',
                          accepted: 'preparing',
                          preparing: 'ready'
                        }[status]
                      )
                    : status === 'ready'
                      ? 'completed'
                      : null;


                return `

                  <div
                    class="order-notif-item"
                    style="margin-bottom:12px;"
                  >

                    <div class="top">

                      <span>

                        <strong>
                          ${formatBillCode(order)}
                        </strong>

                        ${
                          order.note
                            ? ' · ' +
                              escapeHtml(
                                order.note
                              )
                            : ''
                        }

                      </span>


                      <span>
                        ${rupee(order.total)}
                      </span>

                    </div>


                    <div
                      style="
                        margin:6px 0;
                        font-weight:800;
                      "
                    >
                      ${orderStatusLabel(status)}
                    </div>


                    <div class="items">

                      ${
                        (order.items || [])
                          .map(
                            item =>
                              escapeHtml(
                                item.name
                              ) +
                              ' ×' +
                              item.qty
                          )
                          .join(', ')
                      }

                    </div>


                    ${
                      !isBar
                        ? `
                          <div class="acts">

                            <button
                              class="tiny-btn"
                              data-print-status="${order.billNo}"
                            >
                              🖨️ Print
                            </button>


                            ${
                              action
                                ? `
                                  <button
                                    class="tiny-btn"
                                    data-status-action="${order.billNo}"
                                    data-next-status="${nextStatus}"
                                  >
                                    ${action}
                                  </button>
                                `
                                : ''
                            }

                          </div>
                        `
                        : `
                          <div class="acts">

                            ${
                              action
                                ? `
                                  <button
                                    class="tiny-btn"
                                    data-status-action="${order.billNo}"
                                    data-next-status="${nextStatus}"
                                  >
                                    ✅ ${action}
                                  </button>
                                `
                                : ''
                            }

                          </div>
                        `
                    }

                  </div>

                `;
              }).join('')
            : `
              <p
                style="
                  text-align:center;
                  color:var(--muted);
                "
              >
                No active bar orders.
              </p>
            `
        }


        <button
          class="modal-close"
          id="close-bar-modal"
        >
          Close
        </button>

      </div>

    </div>
  `;


  document
    .getElementById(
      'modal-overlay'
    )
    ?.addEventListener(
      'click',
      event => {

        if (
          event.target.id ===
          'modal-overlay'
        ) {
          closeModal();
        }
      }
    );


  document
    .getElementById(
      'close-bar-modal'
    )
    ?.addEventListener(
      'click',
      closeModal
    );


  const autoToggle =
    document.getElementById(
      'autoprint-toggle'
    );


  if (autoToggle) {

    autoToggle.addEventListener(
      'change',
      event => {

        AUTO_PRINT =
          event.target.checked;

        localStorage.setItem(
          AUTOPRINT_KEY,
          AUTO_PRINT
            ? 'on'
            : 'off'
        );
      }
    );
  }


  document
    .querySelectorAll(
      '[data-print-status]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const billNo =
            Number(
              button.dataset
                .printStatus
            );


          const order =
            BAR_ORDERS.find(
              entry =>
                Number(entry.billNo) ===
                billNo
            );


          if (order) {

            printReceipt(
              order
            );
          }
        }
      );
    });


  document
    .querySelectorAll(
      '[data-status-action]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          updateBarOrderStatus(
            Number(
              button.dataset
                .statusAction
            ),
            button.dataset
              .nextStatus
          );
        }
      );
    });
}


function closeModal() {

  const root =
    document.getElementById(
      'modal-root'
    );

  if (root) {
    root.innerHTML = '';
  }
}


/* =========================================================
   ADMIN
   ========================================================= */

function renderAdminShell() {

  return `
    <div class="shell">

      <div class="topbar">

        <div class="who">

          <span class="dot"></span>

          <h2>
            Admin Dashboard
          </h2>

        </div>


        <div class="topbar-actions">

          <button
            class="sync-badge"
            id="bar-orders-btn"
          >
            🔔 Bar orders
            ${
              PENDING_BAR_ORDERS.length
                ? `
                  <span class="cnt">
                    ${PENDING_BAR_ORDERS.length}
                  </span>
                `
                : ''
            }
          </button>


          <span class="pill-btn">
            ${escapeHtml(LABEL)}
          </span>


          <button
            class="pill-btn logout"
            id="logout-btn"
          >
            Log out
          </button>

        </div>

      </div>


      <div class="tabs">

        ${renderAdminTabs()}

      </div>


      <div class="content">

        ${renderAdminTab()}

      </div>

    </div>
  `;
}


function renderAdminTabs() {

  return `

    <button
      class="tab-btn ${
        ADMIN_TAB === 'billing'
          ? 'active'
          : ''
      }"
      data-tab="billing"
    >
      New Bill
    </button>


    <button
      class="tab-btn ${
        ADMIN_TAB === 'closing'
          ? 'active'
          : ''
      }"
      data-tab="closing"
    >
      💰 Day Closing
    </button>


    <button
      class="tab-btn ${
        ADMIN_TAB === 'reports'
          ? 'active'
          : ''
      }"
      data-tab="reports"
    >
      📊 Reports
    </button>


    <button
      class="tab-btn ${
        ADMIN_TAB === 'inventory'
          ? 'active'
          : ''
      }"
      data-tab="inventory"
    >
      📦 Inventory
    </button>


    <button
      class="tab-btn ${
        ADMIN_TAB === 'menu'
          ? 'active'
          : ''
      }"
      data-tab="menu"
    >
      📋 Menu Management
    </button>


    <button
      class="tab-btn ${
        ADMIN_TAB === 'staff'
          ? 'active'
          : ''
      }"
      data-tab="staff"
    >
      🔐 Staff Access
    </button>

  `;
}


function renderAdminTab() {

  if (
    ADMIN_TAB ===
    'billing'
  ) {

    return renderAdminBillingTab();
  }


  if (
    ADMIN_TAB ===
    'closing'
  ) {

    return `
      <div id="day-closing-root">
        Loading…
      </div>
    `;
  }


  if (
    ADMIN_TAB ===
    'reports'
  ) {

    return `
      <div id="reports-root">
        Loading…
      </div>
    `;
  }


  if (
    ADMIN_TAB ===
    'inventory'
  ) {

    return `
      <div id="inventory-root">
        Loading…
      </div>
    `;
  }


  if (
    ADMIN_TAB ===
    'menu'
  ) {

    return renderMenuMgmtTab();
  }


  if (
    ADMIN_TAB ===
    'staff'
  ) {

    return renderStaffAccessTab();
  }


  return '';
}


/* ================= ADMIN BILLING ================= */

function renderAdminBillingTab() {

  return `

    <div class="filters">

      <div class="field">

        <label>
          Counter
        </label>

        <select
          id="admin-counter-select"
        >

          <option
            value="unlimited"
            ${
              ADMIN_BILL_COUNTER ===
              'unlimited'
                ? 'selected'
                : ''
            }
          >
            Unlimited Parotta
          </option>


          <option
            value="bar"
            ${
              ADMIN_BILL_COUNTER ===
              'bar'
                ? 'selected'
                : ''
            }
          >
            Rhythm Bar
          </option>

        </select>

      </div>

    </div>


    ${renderBillingArea(
      ADMIN_BILL_COUNTER
    )}

  `;
}


/* =========================================================
   DAY CLOSING
   ========================================================= */

async function renderDayClosingTab() {

  const root =
    document.getElementById(
      'day-closing-root'
    );

  if (!root) return;


  root.innerHTML = `

    <div
      class="reports-head"
      style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        flex-wrap:wrap;
        gap:10px;
        margin-bottom:14px;
      "
    >

      <div>

        <h3 style="margin:0;">
          💰 Day-End Closing
        </h3>

        <div
          style="
            color:var(--muted);
            font-size:13px;
            margin-top:4px;
          "
        >
          Close today's business
          and reconcile cash.
        </div>

      </div>


      <div style="font-weight:700;">
        ${todayStr()}
      </div>

    </div>


    <div
      id="closing-loading"
      style="
        padding:30px;
        text-align:center;
        color:var(--muted);
      "
    >
      Loading today's sales...
    </div>
  `;


  try {

    const data =
      await api(
        '/api/day-closing/summary'
      );


    const summary =
      data.summary || data;


    const totalOrders =
      Number(
        summary.total_orders ??
        summary.totalOrders ??
        0
      );


    const cashSales =
      Number(
        summary.cash_sales ??
        summary.cashSales ??
        0
      );


    const upiSales =
      Number(
        summary.upi_sales ??
        summary.upiSales ??
        0
      );


    const swiggySales =
      Number(
        summary.swiggy_sales ??
        summary.swiggySales ??
        0
      );


    const zomatoSales =
      Number(
        summary.zomato_sales ??
        summary.zomatoSales ??
        0
      );


    const totalSales =
      Number(
        summary.total_sales ??
        summary.totalSales ??
        (
          cashSales +
          upiSales +
          swiggySales +
          zomatoSales
        )
      );


    const expectedCash =
      Number(
        summary.expected_cash ??
        summary.expectedCash ??
        cashSales
      );


    let existingClosing =
      null;


    try {

      const closingData =
        await api(
          '/api/day-closing'
        );

      existingClosing =
        closingData.closing ||
        null;

    } catch (error) {

      console.warn(
        'Could not load existing day closing:',
        error.message
      );
    }


    root.innerHTML = `

      <div class="grid-cards">

        <div class="stat-card">

          <div class="lbl">
            Today's Orders
          </div>

          <div class="val">
            ${totalOrders}
          </div>

        </div>


        <div class="stat-card gold">

          <div class="lbl">
            Today's Sales
          </div>

          <div class="val">
            ${rupee(totalSales)}
          </div>

        </div>


        <div class="stat-card">

          <div class="lbl">
            💵 Cash Sales
          </div>

          <div class="val">
            ${rupee(cashSales)}
          </div>

        </div>


        <div class="stat-card">

          <div class="lbl">
            📲 UPI / GPay
          </div>

          <div class="val">
            ${rupee(upiSales)}
          </div>

        </div>


        <div class="stat-card">

          <div class="lbl">
            🛵 Swiggy
          </div>

          <div class="val">
            ${rupee(swiggySales)}
          </div>

        </div>


        <div class="stat-card">

          <div class="lbl">
            🛵 Zomato
          </div>

          <div class="val">
            ${rupee(zomatoSales)}
          </div>

        </div>

      </div>


      <div
        class="mgmt-block"
        style="margin-top:20px;"
      >

        <h3>
          Cash Reconciliation
        </h3>


        <div class="grid-cards">

          <div class="stat-card">

            <div class="lbl">
              Expected Cash
            </div>

            <div class="val">
              ${rupee(expectedCash)}
            </div>

          </div>


          <div class="stat-card">

            <div class="lbl">
              Actual Cash
            </div>

            <div
              class="val"
              id="actual-cash-display"
            >
              ₹0.00
            </div>

          </div>


          <div class="stat-card">

            <div class="lbl">
              Difference
            </div>

            <div
              class="val"
              id="cash-difference"
            >
              ₹0.00
            </div>

          </div>

        </div>


        ${
          existingClosing
            ? `

              <div
                style="
                  margin-top:18px;
                  padding:15px;
                  border-radius:10px;
                  background:rgba(34,197,94,.10);
                  border:1px solid rgba(34,197,94,.25);
                "
              >

                <strong>
                  ✅ Business day already closed
                </strong>


                <div
                  style="
                    margin-top:8px;
                    font-size:13px;
                  "
                >
                  Closed by:
                  ${escapeHtml(
                    existingClosing.closed_by ||
                    'Admin'
                  )}
                </div>


                <div
                  style="font-size:13px;"
                >
                  Closed at:
                  ${
                    existingClosing.closed_at
                      ? niceDateTime(
                          existingClosing.closed_at
                        )
                      : '—'
                  }
                </div>


                <div
                  style="font-size:13px;"
                >
                  Actual Cash:
                  ${rupee(
                    Number(
                      existingClosing.actual_cash ||
                      0
                    )
                  )}
                </div>


                <div
                  style="font-size:13px;"
                >
                  Difference:
                  ${rupee(
                    Number(
                      existingClosing.difference ||
                      0
                    )
                  )}
                </div>

              </div>

            `
            : `

              <div
                class="filters"
                style="margin-top:18px;"
              >

                <div class="field">

                  <label>
                    Actual Cash in Drawer
                  </label>

                  <input
                    type="number"
                    id="actual-cash-input"
                    min="0"
                    step="0.01"
                    placeholder="Enter cash counted"
                  >

                </div>

              </div>


              <div
                class="field"
                style="margin-top:10px;"
              >

                <label>
                  Notes
                </label>

                <textarea
                  id="closing-notes"
                  rows="4"
                  placeholder="Optional closing notes..."
                  style="
                    width:100%;
                    resize:vertical;
                  "
                ></textarea>

              </div>


              <div
                style="
                  margin-top:16px;
                  display:flex;
                  gap:10px;
                  align-items:center;
                  flex-wrap:wrap;
                "
              >

                <button
                  class="tiny-btn"
                  id="calculate-difference-btn"
                >
                  Calculate Difference
                </button>


                <button
                  class="tiny-btn"
                  id="close-business-day-btn"
                >
                  🔒 Close Business Day
                </button>


                <span
                  id="closing-message"
                  style="font-size:13px;"
                ></span>

              </div>

            `
        }

      </div>


      <div
        class="mgmt-block"
        style="margin-top:20px;"
      >

        <h3>
          📋 Closing History
        </h3>

        <div id="closing-history">
          Loading history...
        </div>

      </div>
    `;


    bindDayClosingEvents(
      expectedCash
    );

    loadDayClosingHistory();


  } catch (error) {

    root.innerHTML = `

      <div class="mgmt-block">

        <h3>
          💰 Day-End Closing
        </h3>

        <p style="color:#ef4444;">
          Could not load day closing:
          ${escapeHtml(
            error.message
          )}
        </p>


        <button
          class="tiny-btn"
          id="retry-closing-btn"
        >
          Retry
        </button>

      </div>
    `;


    document
      .getElementById(
        'retry-closing-btn'
      )
      ?.addEventListener(
        'click',
        renderDayClosingTab
      );
  }
}


function bindDayClosingEvents(
  expectedCash
) {

  const actualInput =
    document.getElementById(
      'actual-cash-input'
    );


  const differenceDisplay =
    document.getElementById(
      'cash-difference'
    );


  const actualDisplay =
    document.getElementById(
      'actual-cash-display'
    );


  const calculateBtn =
    document.getElementById(
      'calculate-difference-btn'
    );


  const closeBtn =
    document.getElementById(
      'close-business-day-btn'
    );


  const message =
    document.getElementById(
      'closing-message'
    );


  function calculateDifference() {

    if (!actualInput) return;


    const actualCash =
      Number(
        actualInput.value || 0
      );


    const difference =
      actualCash -
      Number(expectedCash || 0);


    if (actualDisplay) {

      actualDisplay.textContent =
        rupee(actualCash);
    }


    if (differenceDisplay) {

      differenceDisplay.textContent =
        rupee(difference);


      differenceDisplay.style.color =
        difference === 0
          ? 'var(--free)'
          : difference > 0
            ? '#16a34a'
            : '#dc2626';
    }


    return {
      actualCash,
      difference
    };
  }


  actualInput?.addEventListener(
    'input',
    calculateDifference
  );


  calculateBtn?.addEventListener(
    'click',
    () => {

      calculateDifference();


      if (message) {

        message.textContent =
          'Difference calculated.';

        message.style.color =
          'var(--muted)';
      }
    }
  );


  closeBtn?.addEventListener(
    'click',
    async () => {

      if (!actualInput) return;


      const actualCash =
        Number(
          actualInput.value
        );


      const notes =
        document
          .getElementById(
            'closing-notes'
          )
          ?.value
          .trim() || '';


      if (
        !Number.isFinite(
          actualCash
        ) ||
        actualCash < 0
      ) {

        if (message) {

          message.textContent =
            'Please enter a valid actual cash amount.';

          message.style.color =
            '#dc2626';
        }

        return;
      }


      const difference =
        actualCash -
        Number(expectedCash || 0);


      const confirmed =
        confirm(
          `Close business day?\n\n` +
          `Expected Cash: ${rupee(expectedCash)}\n` +
          `Actual Cash: ${rupee(actualCash)}\n` +
          `Difference: ${rupee(difference)}`
        );


      if (!confirmed) return;


      closeBtn.disabled =
        true;

      closeBtn.textContent =
        'Closing…';


      try {

        await api(
          '/api/day-closing/close',
          {
            method: 'POST',

            body:
              JSON.stringify({
                date:
                  todayStr(),

                actualCash,

                notes
              })
          }
        );


        showToast(
          '✅ Business day closed successfully.'
        );


        await renderDayClosingTab();


      } catch (error) {

        showToast(
          'Could not close business day: ' +
          error.message
        );


        closeBtn.disabled =
          false;

        closeBtn.textContent =
          '🔒 Close Business Day';
      }
    }
  );
}


async function loadDayClosingHistory() {

  const root =
    document.getElementById(
      'closing-history'
    );

  if (!root) return;


  try {

    const data =
      await api(
        '/api/day-closing/history'
      );


    const closings =
      data.closings || [];


    if (!closings.length) {

      root.innerHTML = `
        <div
          style="
            padding:20px;
            text-align:center;
            color:var(--muted);
          "
        >
          No closing history yet.
        </div>
      `;

      return;
    }


    root.innerHTML = `

      <div class="table-wrap">

        <table>

          <thead>

            <tr>

              <th>Date</th>
              <th>Orders</th>
              <th>Total Sales</th>
              <th>Expected Cash</th>
              <th>Actual Cash</th>
              <th>Difference</th>
              <th>Closed By</th>
              <th>Closed At</th>
              <th>Status</th>

            </tr>

          </thead>


          <tbody>

            ${
              closings
                .map(closing => {

                  const difference =
                    Number(
                      closing.difference ||
                      0
                    );


                  const differenceColor =
                    difference === 0
                      ? 'var(--free)'
                      : difference > 0
                        ? '#16a34a'
                        : '#dc2626';


                  return `

                    <tr>

                      <td>
                        ${escapeHtml(
                          closing.business_date ||
                          '—'
                        )}
                      </td>


                      <td>
                        ${Number(
                          closing.total_orders ||
                          0
                        )}
                      </td>


                      <td>
                        ${rupee(
                          Number(
                            closing.total_sales ||
                            0
                          )
                        )}
                      </td>


                      <td>
                        ${rupee(
                          Number(
                            closing.expected_cash ||
                            0
                          )
                        )}
                      </td>


                      <td>
                        ${rupee(
                          Number(
                            closing.actual_cash ||
                            0
                          )
                        )}
                      </td>


                      <td
                        style="
                          font-weight:700;
                          color:${differenceColor};
                        "
                      >
                        ${rupee(
                          difference
                        )}
                      </td>


                      <td>
                        ${escapeHtml(
                          closing.closed_by ||
                          '—'
                        )}
                      </td>


                      <td>
                        ${
                          closing.closed_at
                            ? niceDateTime(
                                closing.closed_at
                              )
                            : '—'
                        }
                      </td>


                      <td>
                        ${
                          closing.status ===
                          'closed'
                            ? '✅ Closed'
                            : escapeHtml(
                                closing.status ||
                                '—'
                              )
                        }
                      </td>

                    </tr>

                  `;
                })
                .join('')
            }

          </tbody>

        </table>

      </div>
    `;


  } catch (error) {

    root.innerHTML = `

      <div style="color:#ef4444;">

        Could not load closing history:

        ${escapeHtml(
          error.message
        )}

      </div>
    `;
  }
}


/* =========================================================
   REPORTS
   ========================================================= */

async function renderReportsTab() {

  const root =
    document.getElementById(
      'reports-root'
    );

  if (!root) return;


  try {

    const data =
      await api(
        '/api/orders?limit=500'
      );


    const orders =
      data.orders || [];


    ALL_ORDERS_CACHE =
      orders;


    const today =
      todayStr();


    const todayOrders =
      orders.filter(
        order =>
          todayStr(order.time) ===
          today
      );


    const todayTotal =
      todayOrders.reduce(
        (sum, order) =>
          sum +
          Number(order.total || 0),
        0
      );


    const unlimitedTotal =
      todayOrders
        .filter(
          order =>
            order.menuKey ===
            'unlimited'
        )
        .reduce(
          (sum, order) =>
            sum +
            Number(order.total || 0),
          0
        );


    const barTotal =
      todayOrders
        .filter(
          order =>
            order.menuKey ===
            'bar'
        )
        .reduce(
          (sum, order) =>
            sum +
            Number(order.total || 0),
          0
        );


    const allTimeTotal =
      orders.reduce(
        (sum, order) =>
          sum +
          Number(order.total || 0),
        0
      );


    const rangeOrders =
      orders.filter(order => {

        const date =
          todayStr(order.time);

        return (
          date >= REPORT_FROM &&
          date <= REPORT_TO
        );
      });


    const rangeTotal =
      rangeOrders.reduce(
        (sum, order) =>
          sum +
          Number(order.total || 0),
        0
      );


    const cashOrders =
      rangeOrders.filter(
        order =>
          order.paymentMethod !==
          'gpay'
      );


    const gpayOrders =
      rangeOrders.filter(
        order =>
          order.paymentMethod ===
          'gpay'
      );


    const cashTotal =
      cashOrders.reduce(
        (sum, order) =>
          sum +
          Number(order.total || 0),
        0
      );


    const gpayTotal =
      gpayOrders.reduce(
        (sum, order) =>
          sum +
          Number(order.total || 0),
        0
      );


    const itemStats =
      new Map();


    rangeOrders.forEach(
      order => {

        (
          order.items || []
        ).forEach(item => {

          const key =
            item.name;


          const current =
            itemStats.get(key) ||
            {
              name: item.name,
              qty: 0,
              revenue: 0
            };


          current.qty +=
            Number(item.qty) || 0;


          current.revenue +=
            (
              Number(item.qty) || 0
            ) *
            (
              Number(item.price) || 0
            );


          itemStats.set(
            key,
            current
          );
        });
      }
    );


    const topItems =
      [
        ...itemStats.values()
      ]
        .sort(
          (a, b) =>
            b.qty - a.qty
        )
        .slice(0, 5);


    const maxQty =
      topItems.length
        ? topItems[0].qty
        : 1;


    const recent =
      [...rangeOrders]
        .reverse()
        .slice(0, 60);


    root.innerHTML = `

      <div
        class="reports-head"
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          flex-wrap:wrap;
          gap:10px;
          margin-bottom:14px;
        "
      >

        <h3 style="margin:0;">
          Today's Summary
        </h3>


        <button
          class="tiny-btn"
          id="print-overall-btn"
        >
          🖨️ Print Overall Bill
        </button>

      </div>


      <div class="grid-cards">

        <div class="stat-card">

          <div class="lbl">
            Today's Bills
          </div>

          <div class="val">
            ${todayOrders.length}
          </div>

        </div>


        <div class="stat-card">

          <div class="lbl">
            Today's Sales
          </div>

          <div class="val">
            ${rupee(todayTotal)}
          </div>

        </div>


        <div class="stat-card">

          <div class="lbl">
            Unlimited Parotta
          </div>

          <div class="val">
            ${rupee(unlimitedTotal)}
          </div>

        </div>


        <div class="stat-card gold">

          <div class="lbl">
            Rhythm Bar
          </div>

          <div class="val">
            ${rupee(barTotal)}
          </div>

        </div>


        <div class="stat-card">

          <div class="lbl">
            All-time Sales
          </div>

          <div class="val">
            ${rupee(allTimeTotal)}
          </div>

        </div>

      </div>


      <div
        class="reports-head"
        style="margin-top:6px;"
      >

        <h3 style="margin:0;">
          Custom Range
        </h3>

      </div>


      <div class="filters">

        <div class="field">

          <label>
            From
          </label>

          <input
            type="date"
            id="rep-from"
            value="${REPORT_FROM}"
          >

        </div>


        <div class="field">

          <label>
            To
          </label>

          <input
            type="date"
            id="rep-to"
            value="${REPORT_TO}"
          >

        </div>


        <button
          class="tiny-btn"
          id="rep-apply-btn"
        >
          Apply
        </button>


        <button
          class="tiny-btn"
          id="rep-export-btn"
        >
          ⬇️ Export CSV
        </button>

      </div>


      <div class="grid-cards">

        <div class="stat-card">

          <div class="lbl">
            Bills in Range
          </div>

          <div class="val">
            ${rangeOrders.length}
          </div>

        </div>


        <div class="stat-card">

          <div class="lbl">
            Sales in Range
          </div>

          <div class="val">
            ${rupee(rangeTotal)}
          </div>

        </div>


        <div class="stat-card">

          <div class="lbl">
            💵 Cash (${cashOrders.length})
          </div>

          <div class="val">
            ${rupee(cashTotal)}
          </div>

        </div>


        <div class="stat-card gold">

          <div class="lbl">
            📲 GPay (${gpayOrders.length})
          </div>

          <div class="val">
            ${rupee(gpayTotal)}
          </div>

        </div>

      </div>


      <div
        class="table-wrap"
        style="margin-bottom:22px;"
      >

        <h3
          style="
            margin:6px 0 10px;
            font-size:18px;
          "
        >
          🏆 Top-Selling Items
        </h3>


        ${
          topItems.length
            ? topItems.map(item => `

              <div class="top-item-row">

                <div class="top-item-name">
                  ${escapeHtml(
                    item.name
                  )}
                </div>


                <div class="top-item-bar-wrap">

                  <div
                    class="top-item-bar"
                    style="
                      width:${Math.max(
                        6,
                        Math.round(
                          (
                            item.qty /
                            maxQty
                          ) * 100
                        )
                      )}%;
                    "
                  ></div>

                </div>


                <div class="top-item-qty">
                  ${item.qty} sold
                </div>


                <div class="top-item-rev">
                  ${rupee(
                    item.revenue
                  )}
                </div>

              </div>

            `).join('')
            : `
              <p
                style="
                  color:var(--muted);
                  font-size:13px;
                "
              >
                No items sold in this range yet.
              </p>
            `
        }

      </div>


      <div class="table-wrap">

        <table>

          <thead>

            <tr>

              <th>Bill#</th>
              <th>Counter</th>
              <th>Time</th>
              <th>Items</th>
              <th>Note</th>
              <th>Customer</th>
              <th>Customer #</th>
              <th>Served By</th>
              <th>Payment</th>
              <th>Total</th>
              <th></th>

            </tr>

          </thead>


          <tbody>

            ${
              recent.length
                ? recent.map(order => `

                  <tr>

                    <td>
                      ${formatBillCode(order)}
                    </td>


                    <td>

                      <span
                        class="badge ${
                          order.menuKey === 'bar'
                            ? 'rhythm'
                            : 'unlimited'
                        }"
                      >
                        ${counterLabel(
                          order.menuKey
                        )}
                      </span>

                    </td>


                    <td>
                      ${niceDateTime(
                        order.time
                      )}
                    </td>


                    <td>
                      ${
                        (order.items || [])
                          .map(
                            item =>
                              escapeHtml(
                                item.name
                              ) +
                              ' x' +
                              item.qty
                          )
                          .join(', ')
                      }
                    </td>


                    <td>
                      ${escapeHtml(
                        order.note ||
                        '—'
                      )}
                    </td>


                    <td>
                      ${escapeHtml(
                        order.customerName ||
                        '—'
                      )}
                    </td>


                    <td>
                      ${escapeHtml(
                        order.customerMobile ||
                        '—'
                      )}
                    </td>


                    <td>
                      ${escapeHtml(
                        order.servedBy ||
                        '—'
                      )}
                    </td>


                    <td>
                      ${
                        order.paymentMethod ===
                        'gpay'
                          ? '📲 GPay'
                          : '💵 Cash'
                      }
                    </td>


                    <td>
                      ${rupee(
                        order.total
                      )}
                    </td>


                    <td>

                      <button
                        class="tiny-btn"
                        data-reprint="${order.billNo}"
                      >
                        Reprint
                      </button>

                    </td>

                  </tr>

                `).join('')
                : `
                  <tr>

                    <td
                      colspan="11"
                      style="
                        color:var(--muted);
                        text-align:center;
                      "
                    >
                      No bills in this range.
                    </td>

                  </tr>
                `
            }

          </tbody>

        </table>

      </div>
    `;


    document
      .querySelectorAll(
        '[data-reprint]'
      )
      .forEach(button => {

        button.addEventListener(
          'click',
          () => {

            const billNo =
              Number(
                button.dataset
                  .reprint
              );


            const order =
              orders.find(
                entry =>
                  Number(entry.billNo) ===
                  billNo
              );


            if (order) {

              printReceipt(
                order
              );
            }
          }
        );
      });


    document
      .getElementById(
        'print-overall-btn'
      )
      ?.addEventListener(
        'click',
        () => {

          printOverallBill({
            today,
            todayOrders,
            todayTotal,
            unlimitedTotal,
            barTotal,
            allTimeTotal,
            allOrdersCount:
              orders.length
          });
        }
      );


    document
      .getElementById(
        'rep-apply-btn'
      )
      ?.addEventListener(
        'click',
        () => {

          const from =
            document
              .getElementById(
                'rep-from'
              )
              ?.value;


          const to =
            document
              .getElementById(
                'rep-to'
              )
              ?.value;


          if (from) {
            REPORT_FROM =
              from;
          }


          if (to) {
            REPORT_TO =
              to;
          }


          if (
            REPORT_FROM >
            REPORT_TO
          ) {

            const temp =
              REPORT_FROM;

            REPORT_FROM =
              REPORT_TO;

            REPORT_TO =
              temp;
          }


          renderReportsTab();
        }
      );


    document
      .getElementById(
        'rep-export-btn'
      )
      ?.addEventListener(
        'click',
        () =>
          exportOrdersCsv(
            rangeOrders
          )
      );


  } catch (error) {

    root.innerHTML = `

      <div class="mgmt-block">

        <h3>
          📊 Reports
        </h3>

        <p style="color:#ef4444;">
          Could not load reports:
          ${escapeHtml(
            error.message
          )}
        </p>

        <button
          class="tiny-btn"
          id="retry-reports-btn"
        >
          Retry
        </button>

      </div>
    `;


    document
      .getElementById(
        'retry-reports-btn'
      )
      ?.addEventListener(
        'click',
        renderReportsTab
      );
  }
}


/* ================= CSV EXPORT ================= */

function exportOrdersCsv(
  orders
) {

  const headers = [
    'Bill No',
    'Counter',
    'Date',
    'Time',
    'Items',
    'Note',
    'Customer',
    'Customer Mobile',
    'Served By',
    'Payment',
    'Total'
  ];


  const csvEscape =
    value =>
      `"${String(
        value == null
          ? ''
          : value
      ).replace(
        /"/g,
        '""'
      )}"`;


  const rows =
    orders.map(order => {

      return [

        formatBillCode(
          order
        ),

        counterLabel(
          order.menuKey
        ),

        billDateStr(
          order.time
        ),

        billTimeStr(
          order.time
        ),

        (order.items || [])
          .map(
            item =>
              `${item.name} x${item.qty}`
          )
          .join('; '),

        order.note || '',

        order.customerName || '',

        order.customerMobile || '',

        order.servedBy || '',

        order.paymentMethod ===
        'gpay'
          ? 'GPay'
          : 'Cash',

        order.total

      ]
        .map(csvEscape)
        .join(',');
    });


  const csv =
    [
      headers
        .map(csvEscape)
        .join(','),

      ...rows

    ].join('\n');


  const blob =
    new Blob(
      [csv],
      {
        type:
          'text/csv;charset=utf-8;'
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const anchor =
    document.createElement(
      'a'
    );


  anchor.href =
    url;


  anchor.download =
    `sales_${REPORT_FROM}_to_${REPORT_TO}.csv`;


  document.body.appendChild(
    anchor
  );


  anchor.click();


  anchor.remove();


  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1000
  );
}


/* =========================================================
   OVERALL BILL
   ========================================================= */

function printOverallBill(
  data
) {

  const {
    today,
    todayOrders,
    todayTotal,
    unlimitedTotal,
    barTotal,
    allTimeTotal,
    allOrdersCount
  } = data;


  const unlimitedCount =
    todayOrders.filter(
      order =>
        order.menuKey ===
        'unlimited'
    ).length;


  const barCount =
    todayOrders.filter(
      order =>
        order.menuKey ===
        'bar'
    ).length;


  const receipt =
    document.getElementById(
      'receipt-print'
    );


  if (!receipt) return;


  const width =
    RECEIPT_WIDTH;


  const lines = [];


  lines.push(
    centerText(
      SHOP_INFO.name,
      width
    )
  );


  if (SHOP_INFO.tagline) {

    lines.push(
      centerText(
        SHOP_INFO.tagline,
        width
      )
    );
  }


  SHOP_INFO.addressLines
    .forEach(
      line =>
        lines.push(
          centerText(
            line,
            width
          )
        )
    );


  if (SHOP_INFO.phone) {

    lines.push(
      centerText(
        `Ph: +91 ${SHOP_INFO.phone}`,
        width
      )
    );
  }


  lines.push(
    receiptDivider()
  );


  lines.push(
    centerText(
      'OVERALL BILL - DAY SUMMARY',
      width
    )
  );


  lines.push(
    `Date    : ${today}`
  );


  lines.push(
    `Printed : ${niceDateTime(
      new Date().toISOString()
    )}`
  );


  lines.push(
    receiptDivider()
  );


  lines.push(
    itemRow(
      'Counter',
      'Bills',
      'Amount'
    )
  );


  lines.push(
    receiptDivider()
  );


  lines.push(
    itemRow(
      'Unlimited Parotta',
      String(unlimitedCount),
      rupee(unlimitedTotal)
    )
  );


  lines.push(
    itemRow(
      'Rhythm Bar',
      String(barCount),
      rupee(barTotal)
    )
  );


  lines.push(
    receiptDivider()
  );


  lines.push(
    itemRow(
      'Total Bills Today',
      '',
      String(todayOrders.length)
    )
  );


  lines.push(
    itemRow(
      'TOTAL SALES TODAY',
      '',
      rupee(todayTotal)
    )
  );


  lines.push(
    receiptDivider()
  );


  lines.push(
    itemRow(
      'All-Time Bills',
      '',
      String(allOrdersCount)
    )
  );


  lines.push(
    itemRow(
      'All-Time Sales',
      '',
      rupee(allTimeTotal)
    )
  );


  lines.push(
    receiptDivider()
  );


  lines.push('');


  lines.push(
    centerText(
      'Internal summary - not a customer receipt.',
      width
    )
  );


  receipt.innerHTML =
    `
      <pre class="receipt-mono">
${escapeHtml(lines.join('\n'))}
      </pre>
    `;


  setTimeout(
    () => window.print(),
    150
  );
}


/* =========================================================
   MENU MANAGEMENT
   ========================================================= */

function renderMenuMgmtTab() {

  const counters = [
    'unlimited',
    'bar'
  ];


  return counters
    .map(menuKey => {

      const categories =
        STATE.menus[menuKey] || [];


      return `

        <div
          class="mgmt-block ${
            menuKey === 'bar'
              ? 'bar'
              : ''
          }"
        >

          <h3>
            ${counterLabel(menuKey)}
            Menu
          </h3>


          ${
            categories.length
              ? categories.map(
                  (category, categoryIndex) => `

                    <div
                      style="
                        margin-bottom:14px;
                      "
                    >

                      <div
                        style="
                          font-weight:700;
                          font-size:14px;
                          margin-bottom:6px;
                          display:flex;
                          justify-content:space-between;
                          align-items:center;
                          gap:8px;
                          flex-wrap:wrap;
                        "
                      >

                        <div
                          style="
                            display:flex;
                            gap:5px;
                            align-items:center;
                            flex-wrap:wrap;
                          "
                        >

                          <span>
                            ${escapeHtml(
                              category.cat
                            )}
                          </span>


                          <button
                            class="tiny-btn"
                            data-move-cat-up="${menuKey}|${categoryIndex}"
                            ${
                              categoryIndex === 0
                                ? 'disabled'
                                : ''
                            }
                          >
                            ↑
                          </button>


                          <button
                            class="tiny-btn"
                            data-move-cat-down="${menuKey}|${categoryIndex}"
                            ${
                              categoryIndex ===
                              categories.length - 1
                                ? 'disabled'
                                : ''
                            }
                          >
                            ↓
                          </button>


                          <button
                            class="tiny-btn danger"
                            data-del-cat="${menuKey}|${categoryIndex}"
                          >
                            Remove category
                          </button>

                        </div>

                      </div>


                      ${
                        (category.items || [])
                          .map(
                            (item, itemIndex) => `

                              <div
                                class="mgmt-row"
                              >

                                ${
                                  item.image
                                    ? `
                                      <img
                                        class="mgmt-thumb"
                                        src="${escapeHtml(item.image)}"
                                        alt=""
                                      >
                                    `
                                    : `
                                      <span class="mgmt-thumb-empty">
                                        🍽️
                                      </span>
                                    `
                                }


                                <input
                                  class="nm"
                                  value="${escapeHtml(item.name)}"
                                  data-edit="${menuKey}|${categoryIndex}|${itemIndex}|name"
                                >


                                <input
                                  class="pr"
                                  type="number"
                                  min="0"
                                  step="1"
                                  value="${Number(item.price) || 0}"
                                  data-edit="${menuKey}|${categoryIndex}|${itemIndex}|price"
                                >


                                <label
                                  class="photo-label"
                                >
                                  📷 Photo

                                  <input
                                    type="file"
                                    accept="image/*"
                                    style="display:none;"
                                    data-upload="${menuKey}|${categoryIndex}|${itemIndex}"
                                  >

                                </label>


                                <button
                                  class="tiny-btn danger"
                                  data-del-item="${menuKey}|${categoryIndex}|${itemIndex}"
                                >
                                  ✕
                                </button>

                              </div>

                            `
                          )
                          .join('')
                      }


                      <div
                        class="add-row"
                      >

                        <input
                          class="nm"
                          placeholder="New item name"
                          data-newname="${menuKey}|${categoryIndex}"
                        >


                        <input
                          class="pr"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Price"
                          data-newprice="${menuKey}|${categoryIndex}"
                        >


                        <button
                          class="tiny-btn"
                          data-add-item="${menuKey}|${categoryIndex}"
                        >
                          + Add
                        </button>

                      </div>

                    </div>

                  `
                ).join('')
              : `
                <div
                  style="
                    padding:15px;
                    color:var(--muted);
                  "
                >
                  No categories yet.
                </div>
              `
          }


          <div
            class="add-cat-form"
          >

            <input
              placeholder="New category name"
              id="newcat-${menuKey}"
            >


            <button
              class="tiny-btn"
              data-add-cat="${menuKey}"
            >
              + Add Category
            </button>

          </div>

        </div>

      `;
    })
    .join('');
}


/* =========================================================
   INVENTORY
   ========================================================= */

/* ================= INVENTORY ================= */

async function renderInventoryTab() {
  const root = document.getElementById('inventory-root');

  if (!root) return;

  root.innerHTML = `
    <div class="mgmt-block">
      <h3>📦 Inventory</h3>
      <p style="color:var(--muted);">
        Loading inventory...
      </p>
    </div>
  `;

  try {
    const data = await api('/api/inventory');

    const items = data.inventory || data.items || [];

    root.innerHTML = `
      <div class="mgmt-block">

        <div class="inventory-header">
          <div>
            <h3>📦 INVENTORY</h3>
            <p>Manage your stock</p>
          </div>

          <button
            class="tiny-btn"
            id="add-inventory-btn">
            + Add Item
          </button>
        </div>

        ${
          items.length
            ? `
              <div class="table-wrap">

                <table class="inventory-table">

                  <thead>
                    <tr>
                      <th>ITEM</th>
                      <th>QTY</th>
                      <th>UNIT</th>
                      <th>LOW STOCK</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>

                  <tbody>

                    ${items.map(item => {

                      const quantity =
                        Number(item.quantity || 0);

                      const lowStock =
                        Number(
                          item.low_stock ??
                          item.lowStock ??
                          0
                        );

                      const isLow =
                        quantity <= lowStock;

                      return `
                        <tr>

                          <td>
                            <strong>
                              ${escapeHtml(item.name || '')}
                            </strong>
                          </td>

                          <td>
                            ${quantity}
                          </td>

                          <td>
                            ${escapeHtml(item.unit || '')}
                          </td>

                          <td>
                            ${lowStock}
                          </td>

                          <td>
                            ${
                              isLow
                                ? `
                                  <span class="inventory-status low">
                                    🔴 Low
                                  </span>
                                `
                                : `
                                  <span class="inventory-status good">
                                    🟢 In Stock
                                  </span>
                                `
                            }
                          </td>

                          <td>

                            <button
                              class="tiny-btn"
                              data-inventory-edit="${item.id}">
                              Edit
                            </button>

                            <button
                              class="tiny-btn danger"
                              data-inventory-delete="${item.id}">
                              Delete
                            </button>

                          </td>

                        </tr>
                      `;
                    }).join('')}

                  </tbody>

                </table>

              </div>
            `
            : `
              <div class="inventory-empty">
                No inventory items found.
              </div>
            `
        }

      </div>
    `;

    /* ================= ADD ITEM ================= */

    document
      .getElementById('add-inventory-btn')
      ?.addEventListener('click', () => {

        openInventoryModal();

      });


    /* ================= EDIT ================= */

    document
      .querySelectorAll('[data-inventory-edit]')
      .forEach(btn => {

        btn.addEventListener('click', () => {

          const id =
            btn.dataset.inventoryEdit;

          const item =
            items.find(
              x => String(x.id) === String(id)
            );

          if (!item) return;

          openInventoryModal(item);

        });

      });


    /* ================= DELETE ================= */

    document
      .querySelectorAll('[data-inventory-delete]')
      .forEach(btn => {

        btn.addEventListener('click', async () => {

          const id =
            btn.dataset.inventoryDelete;

          const item =
            items.find(
              x => String(x.id) === String(id)
            );

          if (!item) return;

          const confirmed = confirm(
            `Delete inventory item "${item.name}"?`
          );

          if (!confirmed) return;

          try {

            await api(
              `/api/inventory/${id}`,
              {
                method: 'DELETE'
              }
            );

            showToast('Inventory item deleted.');

            renderInventoryTab();

          } catch (e) {

            showToast(
              'Could not delete item: ' +
              e.message
            );

          }

        });

      });

  } catch (e) {

    root.innerHTML = `
      <div class="mgmt-block">

        <h3>📦 Inventory</h3>

        <p style="color:#ef4444;">
          Could not load inventory:
          ${escapeHtml(e.message)}
        </p>

        <button
          class="tiny-btn"
          id="retry-inventory-btn">
          Retry
        </button>

      </div>
    `;

    document
      .getElementById('retry-inventory-btn')
      ?.addEventListener(
        'click',
        renderInventoryTab
      );
  }
}


/* ================= INVENTORY MODAL ================= */

function openInventoryModal(item = null) {

  const isEdit = !!item;

  const root =
    document.getElementById('modal-root');

  root.innerHTML = `

    <div
      class="modal-overlay"
      id="inventory-modal">

      <div class="modal-box">

        <h3>
          ${isEdit ? '✏️ Edit Inventory Item' : '📦 Add Inventory Item'}
        </h3>

        <div class="field">

          <label>Item Name</label>

          <input
            type="text"
            id="inventory-name"
            value="${escapeHtml(item?.name || '')}"
            placeholder="e.g. Tomato">

        </div>


        <div class="field">

          <label>Quantity</label>

          <input
            type="number"
            id="inventory-quantity"
            value="${item?.quantity ?? 0}"
            min="0"
            step="0.01"
            placeholder="e.g. 25">

        </div>


        <div class="field">

          <label>Unit</label>

          <select id="inventory-unit">

            <option value="Kg"
              ${item?.unit === 'Kg' ? 'selected' : ''}>
              Kg
            </option>

            <option value="g"
              ${item?.unit === 'g' ? 'selected' : ''}>
              g
            </option>

            <option value="L"
              ${item?.unit === 'L' ? 'selected' : ''}>
              Litre
            </option>

            <option value="ml"
              ${item?.unit === 'ml' ? 'selected' : ''}>
              ml
            </option>

            <option value="Nos"
              ${item?.unit === 'Nos' ? 'selected' : ''}>
              Nos
            </option>

            <option value="Pack"
              ${item?.unit === 'Pack' ? 'selected' : ''}>
              Pack
            </option>

          </select>

        </div>


        <div class="field">

          <label>Low Stock Alert</label>

          <input
            type="number"
            id="inventory-low-stock"
            value="${
              item?.low_stock ??
              item?.lowStock ??
              0
            }"
            min="0"
            step="0.01"
            placeholder="e.g. 5">

        </div>


        <div
          style="
            display:flex;
            gap:10px;
            margin-top:18px;
          ">

          <button
            class="checkout-btn"
            id="save-inventory-btn">

            ${isEdit ? 'Save Changes' : 'Add Item'}

          </button>

          <button
            class="modal-close"
            id="cancel-inventory-btn">

            Cancel

          </button>

        </div>

      </div>

    </div>
  `;


  document
    .getElementById('cancel-inventory-btn')
    ?.addEventListener(
      'click',
      closeModal
    );


  document
    .getElementById('inventory-modal')
    ?.addEventListener(
      'click',
      e => {

        if (
          e.target.id ===
          'inventory-modal'
        ) {
          closeModal();
        }

      }
    );


  document
    .getElementById('save-inventory-btn')
    ?.addEventListener(
      'click',
      async () => {

        const name =
          document
            .getElementById('inventory-name')
            .value
            .trim();

        const quantity =
          Number(
            document
              .getElementById('inventory-quantity')
              .value
          );

        const unit =
          document
            .getElementById('inventory-unit')
            .value;

        const lowStock =
          Number(
            document
              .getElementById('inventory-low-stock')
              .value
          );


        if (!name) {

          showToast(
            'Please enter item name.'
          );

          return;

        }


        if (
          !Number.isFinite(quantity) ||
          quantity < 0
        ) {

          showToast(
            'Please enter a valid quantity.'
          );

          return;

        }


        if (
          !Number.isFinite(lowStock) ||
          lowStock < 0
        ) {

          showToast(
            'Please enter a valid low-stock value.'
          );

          return;

        }


        const saveBtn =
          document
            .getElementById(
              'save-inventory-btn'
            );

        saveBtn.disabled = true;

        saveBtn.textContent =
          'Saving...';


        try {

          if (isEdit) {

            await api(
              `/api/inventory/${item.id}`,
              {
                method: 'PUT',

                body: JSON.stringify({
  name,
  unit,
  currentStock: quantity,
  minimumStock: lowStock
})
              }
            );

          } else {

            await api(
              '/api/inventory',
              {
                method: 'POST',

                body: JSON.stringify({
  name,
  unit,
  currentStock: quantity,
  minimumStock: lowStock
})
            }
            );

          }


          closeModal();

          showToast(
            isEdit
              ? 'Inventory updated.'
              : 'Inventory item added.'
          );

          renderInventoryTab();


        } catch (e) {

          saveBtn.disabled = false;

          saveBtn.textContent =
            isEdit
              ? 'Save Changes'
              : 'Add Item';

          showToast(
            'Could not save inventory: ' +
            e.message
          );

        }

      }
    );
}

async function loadInventoryTab() {

  const root =
    document.getElementById(
      'inventory-root'
    );

  if (!root) return;


  root.innerHTML = `

    <div class="inventory-loading">

      <div class="inventory-loading-spinner"></div>

      <span>
        Loading inventory...
      </span>

    </div>

  `;


  try {

    /*
     * Daily inventory is used for the dashboard.
     *
     * The existing Add / Edit / Delete APIs
     * are NOT changed.
     */

    const dailyData =
      await api(
        '/api/inventory/daily'
      );


    const data =
      dailyData || {};


    const items =
      data.inventory ||
      data.items ||
      [];


    const totalItems =
      items.length;


    const outOfStock =
      items.filter(
        item =>
          Number(
            item.closing_stock || 0
          ) <= 0
      ).length;


    const lowStock =
      items.filter(
        item => {

          const closing =
            Number(
              item.closing_stock || 0
            );

          const minimum =
            Number(
              item.low_stock ||
              item.lowStock ||
              0
            );

          return (
            closing > 0 &&
            closing <= minimum
          );

        }
      ).length;


    const inStock =
      items.filter(
        item => {

          const closing =
            Number(
              item.closing_stock || 0
            );

          const minimum =
            Number(
              item.low_stock ||
              item.lowStock ||
              0
            );

          return (
            closing > minimum
          );

        }
      ).length;


    const today =
      data.date ||
      new Date()
        .toISOString()
        .slice(0, 10);


    root.innerHTML = `

      <div class="inventory-page">


        <!-- ================= HEADER ================= -->

        <div class="inventory-header">

          <div class="inventory-title">

            <div class="inventory-title-icon">
              📦
            </div>

            <div>

              <h3>
                Inventory
              </h3>

              <p>
                Manage today's stock and inventory levels
              </p>

            </div>

          </div>


          <div class="inventory-header-actions">

            <div class="inventory-date">
              📅 ${escapeHtml(today)}
            </div>


            <button
              type="button"
              class="inventory-refresh-btn"
              id="inventory-refresh-btn"
            >
              ↻ Refresh
            </button>


            <button
              type="button"
              class="inventory-add-btn"
              id="add-inventory-btn"
            >
              + Add Item
            </button>

          </div>

        </div>


        <!-- ================= SUMMARY ================= -->

        <div class="inventory-summary-grid">


          <div class="inventory-summary-card">

            <div class="inventory-summary-icon">
              📦
            </div>

            <div>

              <div class="inventory-summary-label">
                Total Items
              </div>

              <div class="inventory-summary-value">
                ${totalItems}
              </div>

            </div>

          </div>


          <div class="inventory-summary-card inventory-good-card">

            <div class="inventory-summary-icon">
              🟢
            </div>

            <div>

              <div class="inventory-summary-label">
                In Stock
              </div>

              <div class="inventory-summary-value">
                ${inStock}
              </div>

            </div>

          </div>


          <div class="inventory-summary-card inventory-low-card">

            <div class="inventory-summary-icon">
              🟠
            </div>

            <div>

              <div class="inventory-summary-label">
                Low Stock
              </div>

              <div class="inventory-summary-value">
                ${lowStock}
              </div>

            </div>

          </div>


          <div class="inventory-summary-card inventory-out-card">

            <div class="inventory-summary-icon">
              🔴
            </div>

            <div>

              <div class="inventory-summary-label">
                Out of Stock
              </div>

              <div class="inventory-summary-value">
                ${outOfStock}
              </div>

            </div>

          </div>

        </div>


        <!-- ================= SEARCH ================= -->

        <div class="inventory-toolbar">


          <div class="inventory-search">

            <span>
              🔍
            </span>

            <input
              type="search"
              id="inventory-search"
              placeholder="Search ingredients..."
              autocomplete="off"
            >

          </div>


          <select
            id="inventory-status-filter"
            class="inventory-filter"
          >

            <option value="all">
              All Status
            </option>

            <option value="good">
              🟢 In Stock
            </option>

            <option value="low">
              🟠 Low Stock
            </option>

            <option value="out">
              🔴 Out of Stock
            </option>

          </select>

        </div>


        <!-- ================= TABLE ================= -->

        <div class="inventory-table-card">


          <div class="inventory-table-header">

            <div>

              <h4>
                Today's Inventory
              </h4>

              <p>
                Opening → Bought → Used → Closing
              </p>

            </div>


            <span class="inventory-count-badge">
              ${totalItems} items
            </span>

          </div>


          <div class="inventory-table-scroll">


            <table
              class="inventory-dashboard-table"
            >


              <thead>

                <tr>

                  <th>
                    ITEM
                  </th>

                  <th>
                    OPENING
                  </th>

                  <th>
                    BOUGHT TODAY
                  </th>

                  <th>
                    USED TODAY
                  </th>

                  <th>
                    CLOSING STOCK
                  </th>

                  <th>
                    COST
                  </th>

                  <th>
                    LOW STOCK
                  </th>

                  <th>
                    UNIT
                  </th>

                  <th>
                    STATUS
                  </th>

                  <th>
                    ACTIONS
                  </th>

                </tr>

              </thead>


              <tbody
                id="inventory-table-body"
              >

                ${
                  items.length

                    ?

                    items.map(
                      item => {

                        const opening =
                          Number(
                            item.opening_stock ||
                            0
                          );


                        const bought =
                          Number(
                            item.bought_today ||
                            0
                          );


                        const used =
                          Number(
                            item.used_today ||
                            0
                          );


                        const closing =
                          Number(
                            item.closing_stock ||
                            0
                          );


                        const cost =
                          Number(
                            item.cost ||
                            0
                          );


                        const minimum =
                          Number(
                            item.low_stock ||
                            item.lowStock ||
                            0
                          );


                        let status =
                          'good';

                        let statusText =
                          '🟢 Good';


                        if (
                          closing <= 0
                        ) {

                          status =
                            'out';

                          statusText =
                            '🔴 Out of Stock';

                        } else if (
                          closing <= minimum
                        ) {

                          status =
                            'low';

                          statusText =
                            '🟠 Low Stock';

                        }


                        return `

                          <tr
                            class="inventory-row"
                            data-name="${escapeHtml(
                              String(
                                item.name ||
                                ''
                              ).toLowerCase()
                            )}"
                            data-status="${status}"
                          >


                            <td>

                              <div class="inventory-item-cell">

                                <div class="inventory-item-icon">
                                  📦
                                </div>

                                <div>

                                  <strong>
                                    ${escapeHtml(
                                      item.name ||
                                      ''
                                    )}
                                  </strong>

                                  <small>
                                    ID #${escapeHtml(
                                      String(
                                        item.id ||
                                        ''
                                      )
                                    )}
                                  </small>

                                </div>

                              </div>

                            </td>


                            <td>
                              ${opening}
                            </td>


                            <td>

                              <span class="inventory-positive">
                                +${bought}
                              </span>

                            </td>


                            <td>

                              <span class="inventory-negative">
                                -${used}
                              </span>

                            </td>


                            <td>

                              <div class="inventory-closing">

                                <strong>
                                  ${closing}
                                </strong>

                                <span>
                                  ${escapeHtml(
                                    item.unit ||
                                    ''
                                  )}
                                </span>

                              </div>

                            </td>


                            <td>

                              ₹${cost.toFixed(2)}

                            </td>


                            <td>
                              ${minimum}
                            </td>


                            <td>

                              ${escapeHtml(
                                item.unit ||
                                ''
                              )}

                            </td>


                            <td>

                              <span
                                class="inventory-status-badge ${status}"
                              >
                                ${statusText}
                              </span>

                            </td>


                            <td>

                              <div class="inventory-action-buttons">


                                <button
                                  type="button"
                                  class="inventory-action-btn edit"
                                  data-inventory-edit="${escapeHtml(
                                    String(
                                      item.id ||
                                      ''
                                    )
                                  )}"
                                >
                                  Edit
                                </button>


                                <button
                                  type="button"
                                  class="inventory-action-btn delete"
                                  data-inventory-delete="${escapeHtml(
                                    String(
                                      item.id ||
                                      ''
                                    )
                                  )}"
                                >
                                  Delete
                                </button>


                              </div>

                            </td>


                          </tr>

                        `;

                      }
                    ).join('')


                    :

                    `

                      <tr>

                        <td
                          colspan="10"
                          class="inventory-empty-cell"
                        >

                          <div class="inventory-empty-icon">
                            📦
                          </div>

                          <strong>
                            No inventory items
                          </strong>

                          <span>
                            Add your first inventory item to get started.
                          </span>

                        </td>

                      </tr>

                    `
                }

              </tbody>

            </table>

          </div>

        </div>


        <!-- ================= INFO ================= -->

        <div class="inventory-info-card">

          <div class="inventory-info-icon">
            ℹ️
          </div>

          <div>

            <strong>
              Daily stock flow
            </strong>

            <p>
              Today's closing stock becomes tomorrow's opening stock automatically.
            </p>

          </div>

        </div>


      </div>

    `;


    /* ================= REFRESH ================= */

    document
      .getElementById(
        'inventory-refresh-btn'
      )
      ?.addEventListener(
        'click',
        loadInventoryTab
      );


    /* ================= SEARCH ================= */

    const searchInput =
      document.getElementById(
        'inventory-search'
      );


    const statusFilter =
      document.getElementById(
        'inventory-status-filter'
      );


    function filterInventory() {

      const search =
        String(
          searchInput?.value ||
          ''
        )
          .trim()
          .toLowerCase();


      const selectedStatus =
        statusFilter?.value ||
        'all';


      document
        .querySelectorAll(
          '.inventory-row'
        )
        .forEach(
          row => {

            const name =
              row.dataset.name ||
              '';


            const status =
              row.dataset.status ||
              'good';


            const matchesSearch =
              !search ||
              name.includes(
                search
              );


            const matchesStatus =
              selectedStatus ===
                'all' ||
              selectedStatus ===
                status;


            row.style.display =
              matchesSearch &&
              matchesStatus
                ? ''
                : 'none';

          }
        );

    }


    searchInput
      ?.addEventListener(
        'input',
        filterInventory
      );


    statusFilter
      ?.addEventListener(
        'change',
        filterInventory
      );


    /*
     * IMPORTANT:
     *
     * Existing Add / Edit / Delete
     * functionality remains in
     * bindInventoryEvents().
     */

    bindInventoryEvents(
      items
    );


  } catch (error) {

    console.error(
      'Inventory loading error:',
      error
    );


    root.innerHTML = `

      <div class="inventory-error">

        <div class="inventory-error-icon">
          ⚠️
        </div>

        <h3>
          Could not load inventory
        </h3>

        <p>
          ${escapeHtml(
            error.message
          )}
        </p>


        <button
          type="button"
          class="inventory-refresh-btn"
          id="retry-inventory-btn"
        >
          ↻ Try Again
        </button>

      </div>

    `;


    document
      .getElementById(
        'retry-inventory-btn'
      )
      ?.addEventListener(
        'click',
        loadInventoryTab
      );

  }

}


function bindInventoryEvents(
  items
) {

  document
    .getElementById(
      'add-inventory-btn'
    )
    ?.addEventListener(
      'click',
      openAddInventoryModal
    );


  document
    .querySelectorAll(
      '[data-inventory-delete]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        async () => {

          const id =
            button.dataset
              .inventoryDelete;


          const confirmed =
            confirm(
              'Delete this inventory item?'
            );


          if (!confirmed) return;


          try {

            await api(
              `/api/inventory/${encodeURIComponent(id)}`,
              {
                method: 'DELETE'
              }
            );


            showToast(
              'Inventory item deleted.'
            );


            await loadInventoryTab();


          } catch (error) {

            showToast(
              'Could not delete inventory: ' +
              error.message
            );
          }
        }
      );
    });


  document
    .querySelectorAll(
      '[data-inventory-edit]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const id =
            button.dataset
              .inventoryEdit;


          const item =
            items.find(
              entry =>
                String(entry.id) ===
                String(id)
            );


          if (item) {

            openEditInventoryModal(
              item
            );
          }
        }
      );
    });
}


function openAddInventoryModal() {

  const root =
    document.getElementById(
      'modal-root'
    );

  if (!root) return;


  root.innerHTML = `

    <div
      class="modal-overlay"
      id="inventory-modal"
    >

      <div class="modal-box">

        <h3>
          📦 Add Inventory Item
        </h3>


        <div class="field">

          <label>
            Item Name
          </label>

          <input
            id="inventory-name"
            placeholder="e.g. Parotta Flour"
          >

        </div>


        <div class="field">

          <label>
            Quantity
          </label>

          <input
            id="inventory-quantity"
            type="number"
            min="0"
            step="0.01"
            placeholder="100"
          >

        </div>


        <div class="field">

          <label>
            Unit
          </label>

          <input
            id="inventory-unit"
            placeholder="kg / litre / pcs"
          >

        </div>


        <div class="field">

          <label>
            Low Stock Level
          </label>

          <input
            id="inventory-low-stock"
            type="number"
            min="0"
            step="0.01"
            placeholder="10"
          >

        </div>


        <div
          style="
            display:flex;
            gap:10px;
            margin-top:16px;
          "
        >

          <button
            class="tiny-btn"
            id="save-inventory-btn"
          >
            Save
          </button>


          <button
            class="modal-close"
            id="cancel-inventory-btn"
          >
            Cancel
          </button>

        </div>

      </div>

    </div>
  `;


  document
    .getElementById(
      'cancel-inventory-btn'
    )
    ?.addEventListener(
      'click',
      closeModal
    );


  document
    .getElementById(
      'inventory-modal'
    )
    ?.addEventListener(
      'click',
      event => {

        if (
          event.target.id ===
          'inventory-modal'
        ) {
          closeModal();
        }
      }
    );


  document
    .getElementById(
      'save-inventory-btn'
    )
    ?.addEventListener(
      'click',
      async () => {

        const name =
          document
            .getElementById(
              'inventory-name'
            )
            ?.value
            .trim();


        const quantity =
          Number(
            document
              .getElementById(
                'inventory-quantity'
              )
              ?.value || 0
          );


        const unit =
          document
            .getElementById(
              'inventory-unit'
            )
            ?.value
            .trim();


        const lowStock =
          Number(
            document
              .getElementById(
                'inventory-low-stock'
              )
              ?.value || 0
          );


        if (!name) {

          showToast(
            'Please enter an item name.'
          );

          return;
        }


        const button =
          document.getElementById(
            'save-inventory-btn'
          );


        button.disabled =
          true;

        button.textContent =
          'Saving…';


        try {

          await api(
            '/api/inventory',
            {
              method: 'POST',

             body:
  JSON.stringify({
    name,
    unit,
    currentStock: quantity,
    minimumStock: lowStock
  })
            }
          );


          closeModal();

          showToast(
            'Inventory item added.'
          );


          await loadInventoryTab();


        } catch (error) {

          showToast(
            'Could not add inventory: ' +
            error.message
          );


          button.disabled =
            false;

          button.textContent =
            'Save';
        }
      }
    );
}


function openEditInventoryModal(
  item
) {

  const root =
    document.getElementById(
      'modal-root'
    );

  if (!root) return;


  root.innerHTML = `

    <div
      class="modal-overlay"
      id="inventory-edit-modal"
    >

      <div class="modal-box">

        <h3>
          ✏️ Edit Inventory
        </h3>


        <div class="field">

          <label>
            Item Name
          </label>

          <input
            id="inventory-edit-name"
            value="${escapeHtml(
              item.name || ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Quantity
          </label>

          <input
            id="inventory-edit-quantity"
            type="number"
            min="0"
            step="0.01"
            value="${Number(
              item.quantity || 0
            )}"
          >

        </div>


        <div class="field">

          <label>
            Unit
          </label>

          <input
            id="inventory-edit-unit"
            value="${escapeHtml(
              item.unit || ''
            )}"
          >

        </div>


        <div class="field">

          <label>
            Low Stock Level
          </label>

          <input
            id="inventory-edit-low-stock"
            type="number"
            min="0"
            step="0.01"
            value="${Number(
              item.low_stock ??
              item.lowStock ??
              0
            )}"
          >

        </div>


        <div
          style="
            display:flex;
            gap:10px;
            margin-top:16px;
          "
        >

          <button
            class="tiny-btn"
            id="update-inventory-btn"
          >
            Update
          </button>


          <button
            class="modal-close"
            id="cancel-inventory-edit-btn"
          >
            Cancel
          </button>

        </div>

      </div>

    </div>
  `;


  document
    .getElementById(
      'cancel-inventory-edit-btn'
    )
    ?.addEventListener(
      'click',
      closeModal
    );


  document
    .getElementById(
      'inventory-edit-modal'
    )
    ?.addEventListener(
      'click',
      event => {

        if (
          event.target.id ===
          'inventory-edit-modal'
        ) {
          closeModal();
        }
      }
    );


  document
    .getElementById(
      'update-inventory-btn'
    )
    ?.addEventListener(
      'click',
      async () => {

        const name =
          document
            .getElementById(
              'inventory-edit-name'
            )
            ?.value
            .trim();


        const quantity =
          Number(
            document
              .getElementById(
                'inventory-edit-quantity'
              )
              ?.value || 0
          );


        const unit =
          document
            .getElementById(
              'inventory-edit-unit'
            )
            ?.value
            .trim();


        const lowStock =
          Number(
            document
              .getElementById(
                'inventory-edit-low-stock'
              )
              ?.value || 0
          );


        if (!name) {

          showToast(
            'Item name is required.'
          );

          return;
        }


        const button =
          document.getElementById(
            'update-inventory-btn'
          );


        button.disabled =
          true;

        button.textContent =
          'Updating…';


        try {

          await api(
            `/api/inventory/${encodeURIComponent(item.id)}`,
            {
              method: 'PUT',

              body:
  JSON.stringify({
    name,
    unit,
    currentStock: quantity,
    minimumStock: lowStock
  })
            }
          );


          closeModal();

          showToast(
            'Inventory updated.'
          );


          await loadInventoryTab();


        } catch (error) {

          showToast(
            'Could not update inventory: ' +
            error.message
          );


          button.disabled =
            false;

          button.textContent =
            'Update';
        }
      }
    );
}


/* =========================================================
   STAFF ACCESS
   ========================================================= */

function renderStaffAccessTab() {

  const users =
    STATE.users || {};


  const adminPin =
    users.admin?.pin ||
    users.admin ||
    '';


  const staffPin =
    users.staff?.pin ||
    users.staff ||
    '';


  const barPin =
    users.bar?.pin ||
    users.bar ||
    '';


  return `

    <div class="mgmt-block">

      <h3>
        🔐 Staff Access
      </h3>


      <p
        style="
          color:var(--muted);
          font-size:13px;
        "
      >
        Change the PIN used by each
        counter.
      </p>


      <div class="filters">


        <div class="field">

          <label>
            Admin PIN
          </label>

          <input
            type="password"
            data-pin="admin"
            value="${escapeHtml(
              adminPin
            )}"
          >

        </div>


        <div class="field">

          <label>
            Unlimited Staff PIN
          </label>

          <input
            type="password"
            data-pin="staff"
            value="${escapeHtml(
              staffPin
            )}"
          >

        </div>


        <div class="field">

          <label>
            Rhythm Bar PIN
          </label>

          <input
            type="password"
            data-pin="bar"
            value="${escapeHtml(
              barPin
            )}"
          >

        </div>


      </div>


      <div
        style="
          display:flex;
          align-items:center;
          gap:12px;
          margin-top:15px;
        "
      >

        <button
          class="tiny-btn"
          id="save-pins-btn"
        >
          💾 Save PINs
        </button>


        <span
          id="pin-saved-msg"
          style="
            color:var(--free);
            font-size:13px;
          "
        ></span>

      </div>

    </div>
  `;
}


/* =========================================================
   ADMIN EVENTS
   ========================================================= */

function attachAdminEvents() {

  document
    .getElementById(
      'logout-btn'
    )
    ?.addEventListener(
      'click',
      logout
    );


  document
    .getElementById(
      'bar-orders-btn'
    )
    ?.addEventListener(
      'click',
      openBarOrdersModal
    );


  startPolling();


  bindAdminTabNavigation();

  bindAdminTabEvents();
}


function bindAdminTabNavigation() {

  document
    .querySelectorAll(
      '.tab-btn'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          ADMIN_TAB =
            button.dataset.tab;

          CART = [];

          renderAdminContent();
        }
      );
    });
}


function renderAdminContent() {

  const tabs =
    document.querySelector(
      '.tabs'
    );


  const content =
    document.querySelector(
      '.content'
    );


  if (!tabs || !content) return;


  tabs.innerHTML =
    renderAdminTabs();


  content.innerHTML =
    renderAdminTab();


  bindAdminTabNavigation();

  bindAdminTabEvents();
}


function bindAdminTabEvents() {


  /* ================= DAY CLOSING ================= */

  if (
    ADMIN_TAB ===
    'closing'
  ) {

    renderDayClosingTab();
  }


  /* ================= BILLING ================= */

  if (
    ADMIN_TAB ===
    'billing'
  ) {

    const select =
      document.getElementById(
        'admin-counter-select'
      );


    select?.addEventListener(
      'change',
      () => {

        ADMIN_BILL_COUNTER =
          select.value;

        CART = [];

        renderAdminContent();
      }
    );


    bindBillingEvents(
      ADMIN_BILL_COUNTER,
      renderAdminContent
    );
  }


  /* ================= REPORTS ================= */

  if (
    ADMIN_TAB ===
    'reports'
  ) {

    renderReportsTab();
  }


  /* ================= INVENTORY ================= */

  if (
    ADMIN_TAB ===
    'inventory'
  ) {

    const root =
      document.getElementById(
        'inventory-root'
      );


    if (root) {

      loadInventoryTab();
    }
  }


  /* ================= MENU ================= */

  if (
    ADMIN_TAB ===
    'menu'
  ) {

    bindMenuManagementEvents();
  }


  /* ================= STAFF ================= */

  if (
    ADMIN_TAB ===
    'staff'
  ) {

    const saveButton =
      document.getElementById(
        'save-pins-btn'
      );


    saveButton?.addEventListener(
      'click',
      async () => {

        const pins = {};


        document
          .querySelectorAll(
            '[data-pin]'
          )
          .forEach(input => {

            pins[
              input.dataset.pin
            ] =
              input.value.trim();
          });


        try {

          await api(
            '/api/users/pins',
            {
              method: 'PUT',

              body:
                JSON.stringify(
                  pins
                )
            }
          );


          const message =
            document.getElementById(
              'pin-saved-msg'
            );


          if (message) {

            message.textContent =
              'Saved successfully.';

            setTimeout(
              () => {

                if (
                  message
                ) {
                  message.textContent =
                    '';
                }

              },
              2500
            );
          }


          showToast(
            'Staff PINs updated.'
          );


        } catch (error) {

          showToast(
            'Save failed: ' +
            error.message
          );
        }
      }
    );
  }
}


/* =========================================================
   MENU MANAGEMENT EVENTS
   ========================================================= */

function bindMenuManagementEvents() {


  /* ================= EDIT ITEM ================= */

  document
    .querySelectorAll(
      '[data-edit]'
    )
    .forEach(input => {

      input.addEventListener(
        'change',
        async () => {

          const [
            menuKey,
            categoryIndexRaw,
            itemIndexRaw,
            field
          ] =
            input.dataset.edit
              .split('|');


          const categoryIndex =
            Number(
              categoryIndexRaw
            );


          const itemIndex =
            Number(
              itemIndexRaw
            );


          const item =
            STATE
              .menus[menuKey]
              ?.[categoryIndex]
              ?.items?.[itemIndex];


          if (!item) return;


          if (
            field === 'price'
          ) {

            item.price =
              Math.max(
                0,
                Number(
                  input.value
                ) || 0
              );

          } else {

            item[field] =
              input.value.trim();
          }


          try {

            await saveMenus();

            showToast(
              'Menu item saved.'
            );

          } catch (error) {

            showToast(
              'Save failed: ' +
              error.message
            );
          }
        }
      );
    });


  /* ================= PHOTO UPLOAD ================= */

  document
    .querySelectorAll(
      '[data-upload]'
    )
    .forEach(input => {

      input.addEventListener(
        'change',
        async () => {

          const file =
            input.files?.[0];


          if (!file) return;


          const [
            menuKey,
            categoryIndexRaw,
            itemIndexRaw
          ] =
            input.dataset.upload
              .split('|');


          const categoryIndex =
            Number(
              categoryIndexRaw
            );


          const itemIndex =
            Number(
              itemIndexRaw
            );


          try {

            const formData =
              new FormData();


            formData.append(
              'image',
              file
            );


            const result =
              await api(
                '/api/upload',
                {
                  method: 'POST',
                  body: formData
                }
              );


            const item =
              STATE
                .menus[menuKey]
                ?.[categoryIndex]
                ?.items?.[itemIndex];


            if (!item) return;


            item.image =
              result.url;


            await saveMenus();


            showToast(
              'Photo uploaded.'
            );


            renderAdminContent();


          } catch (error) {

            showToast(
              'Photo upload failed: ' +
              error.message
            );
          }
        }
      );
    });


  /* ================= DELETE ITEM ================= */

  document
    .querySelectorAll(
      '[data-del-item]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        async () => {

          const [
            menuKey,
            categoryIndexRaw,
            itemIndexRaw
          ] =
            button.dataset.delItem
              .split('|');


          const categoryIndex =
            Number(
              categoryIndexRaw
            );


          const itemIndex =
            Number(
              itemIndexRaw
            );


          const category =
            STATE
              .menus[menuKey]
              ?.[categoryIndex];


          if (!category) return;


          const item =
            category.items?.[
              itemIndex
            ];


          if (!item) return;


          const confirmed =
            confirm(
              `Remove "${item.name}" from the menu?`
            );


          if (!confirmed) return;


          try {

            category.items.splice(
              itemIndex,
              1
            );


            await saveMenus();


            renderAdminContent();


          } catch (error) {

            showToast(
              'Could not remove item: ' +
              error.message
            );
          }
        }
      );
    });


  /* ================= DELETE CATEGORY ================= */

  document
    .querySelectorAll(
      '[data-del-cat]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        async () => {

          const [
            menuKey,
            categoryIndexRaw
          ] =
            button.dataset.delCat
              .split('|');


          const categoryIndex =
            Number(
              categoryIndexRaw
            );


          const category =
            STATE
              .menus[menuKey]
              ?.[categoryIndex];


          if (!category) return;


          const confirmed =
            confirm(
              `Remove category "${category.cat}" and all its items?`
            );


          if (!confirmed) return;


          try {

            STATE
              .menus[menuKey]
              .splice(
                categoryIndex,
                1
              );


            await saveMenus();


            renderAdminContent();


          } catch (error) {

            showToast(
              'Could not remove category: ' +
              error.message
            );
          }
        }
      );
    });


  /* ================= MOVE CATEGORY UP ================= */

  document
    .querySelectorAll(
      '[data-move-cat-up]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        async () => {

          const [
            menuKey,
            indexRaw
          ] =
            button.dataset
              .moveCatUp
              .split('|');


          const index =
            Number(indexRaw);


          const categories =
            STATE.menus[menuKey];


          if (
            !categories ||
            index <= 0
          ) {
            return;
          }


          [
            categories[index - 1],
            categories[index]
          ] =
            [
              categories[index],
              categories[index - 1]
            ];


          try {

            await saveMenus();

            renderAdminContent();

          } catch (error) {

            showToast(
              'Could not move category: ' +
              error.message
            );
          }
        }
      );
    });


  /* ================= MOVE CATEGORY DOWN ================= */

  document
    .querySelectorAll(
      '[data-move-cat-down]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        async () => {

          const [
            menuKey,
            indexRaw
          ] =
            button.dataset
              .moveCatDown
              .split('|');


          const index =
            Number(indexRaw);


          const categories =
            STATE.menus[menuKey];


          if (
            !categories ||
            index >=
              categories.length - 1
          ) {
            return;
          }


          [
            categories[index],
            categories[index + 1]
          ] =
            [
              categories[index + 1],
              categories[index]
            ];


          try {

            await saveMenus();

            renderAdminContent();

          } catch (error) {

            showToast(
              'Could not move category: ' +
              error.message
            );
          }
        }
      );
    });


  /* ================= ADD ITEM ================= */

  document
    .querySelectorAll(
      '[data-add-item]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        async () => {

          const [
            menuKey,
            categoryIndexRaw
          ] =
            button.dataset
              .addItem
              .split('|');


          const categoryIndex =
            Number(
              categoryIndexRaw
            );


          const nameInput =
            document.querySelector(
              `[data-newname="${menuKey}|${categoryIndex}"]`
            );


          const priceInput =
            document.querySelector(
              `[data-newprice="${menuKey}|${categoryIndex}"]`
            );


          const name =
            nameInput
              ?.value
              .trim();


          const price =
            Math.max(
              0,
              Number(
                priceInput?.value || 0
              )
            );


          if (!name) {

            showToast(
              'Enter an item name.'
            );

            return;
          }


          const category =
            STATE
              .menus[menuKey]
              ?.[categoryIndex];


          if (!category) return;


          category.items =
            category.items || [];


          category.items.push({
            id:
              'm' +
              Date.now().toString(36) +
              Math.floor(
                Math.random() * 1000
              ),

            name,

            price,

            image: null
          });


          try {

            await saveMenus();

            renderAdminContent();

          } catch (error) {

            showToast(
              'Could not add item: ' +
              error.message
            );
          }
        }
      );
    });


  /* ================= ADD CATEGORY ================= */

  document
    .querySelectorAll(
      '[data-add-cat]'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        async () => {

          const menuKey =
            button.dataset.addCat;


          const input =
            document.getElementById(
              'newcat-' +
              menuKey
            );


          const name =
            input
              ?.value
              .trim();


          if (!name) {

            showToast(
              'Enter a category name.'
            );

            return;
          }


          STATE
            .menus[menuKey]
            .push({
              cat: name,
              items: []
            });


          try {

            await saveMenus();

            renderAdminContent();

          } catch (error) {

            showToast(
              'Could not add category: ' +
              error.message
            );
          }
        }
      );
    });
}


async function saveMenus() {

  await api(
    '/api/menu',
    {
      method: 'PUT',

      body:
        JSON.stringify({
          menus:
            STATE.menus
        })
    }
  );
}


/* =========================================================
   OPTIONAL BILL IMAGE / WHATSAPP / SMS
   ========================================================= */

function loadImageEl(
  source
) {

  return new Promise(
    (resolve, reject) => {

      const image =
        new Image();

      image.onload =
        () => resolve(image);

      image.onerror =
        reject;

      image.src =
        source;
    }
  );
}


async function generateBillImageBlob(
  order
) {

  const width = 380;
  const rowHeight = 22;
  const qrSize = 150;

  const payBlockHeight =
    order.upiLink
      ? 36 + qrSize + 40
      : 60;

  const ratingBlockHeight =
    90;

  const infoBlockHeight =
    227;


  const height =
    infoBlockHeight +
    60 +
    (
      (order.items || []).length *
      rowHeight
    ) +
    40 +
    payBlockHeight +
    ratingBlockHeight +
    90;


  const canvas =
    document.createElement(
      'canvas'
    );


  const scale = 2;


  canvas.width =
    width * scale;

  canvas.height =
    height * scale;


  const context =
    canvas.getContext(
      '2d'
    );


  context.scale(
    scale,
    scale
  );


  context.fillStyle =
    '#ffffff';

  context.fillRect(
    0,
    0,
    width,
    height
  );


  const divider =
    (
      y,
      strong = false
    ) => {

      context.strokeStyle =
        strong
          ? '#111827'
          : '#d1d5db';

      context.lineWidth =
        strong
          ? 1.5
          : 1;


      context.beginPath();

      context.moveTo(
        20,
        y
      );

      context.lineTo(
        width - 20,
        y
      );

      context.stroke();

      context.lineWidth =
        1;
    };


  let y = 32;


  context.textAlign =
    'center';

  context.fillStyle =
    '#111827';


  context.font =
    'bold 22px Arial, sans-serif';


  context.fillText(
    SHOP_INFO.name,
    width / 2,
    y
  );


  y += 20;


  context.font =
    '11px Arial, sans-serif';


  context.fillStyle =
    '#4b5563';


  if (SHOP_INFO.tagline) {

    context.fillText(
      SHOP_INFO.tagline,
      width / 2,
      y
    );

    y += 16;
  }


  y += 4;


  divider(
    y,
    true
  );


  y += 20;


  SHOP_INFO.addressLines
    .forEach(
      line => {

        context.fillText(
          line,
          width / 2,
          y
        );

        y += 15;
      }
    );


  if (SHOP_INFO.phone) {

    context.fillText(
      'Ph: +91 ' +
      SHOP_INFO.phone,
      width / 2,
      y
    );

    y += 15;
  }


  y += 6;


  divider(
    y,
    true
  );


  y += 22;


  context.font =
    'bold 15px Arial, sans-serif';

  context.fillStyle =
    '#111827';


  context.fillText(
    'BILL',
    width / 2,
    y
  );


  y += 20;


  context.font =
    '12px Arial, sans-serif';

  context.textAlign =
    'left';


  const infoLines = [

    `Bill No  : ${formatBillCode(order)}`,

    `Date     : ${billDateStr(order.time)}`,

    `Time     : ${billTimeStr(order.time)}`,

    `Table No : ${order.note || '-'}`,

    `Cashier  : ${order.servedBy || '-'}`,

    `Payment  : ${
      order.paymentMethod === 'gpay'
        ? 'GPay (Paid ✓)'
        : 'Cash'
    }`

  ];


  infoLines.forEach(
    line => {

      context.fillText(
        line,
        20,
        y
      );

      y += 17;
    }
  );


  divider(y);

  y += 20;


  context.fillText(
    `Customer : ${order.customerName || '-'}`,
    20,
    y
  );

  y += 17;


  context.fillText(
    `Mobile   : ${
      order.customerMobile
        ? '+91 ' +
          order.customerMobile
        : '-'
    }`,
    20,
    y
  );


  y += 12;


  divider(y);

  y += 22;


  context.font =
    'bold 12px Arial, sans-serif';


  context.fillText(
    'S.No  Item',
    20,
    y
  );


  context.textAlign =
    'center';


  context.fillText(
    'Qty',
    width - 150,
    y
  );


  context.textAlign =
    'right';


  context.fillText(
    'Rate',
    width - 95,
    y
  );


  context.fillText(
    'Amount',
    width - 20,
    y
  );


  y += 8;


  divider(y);

  y += 18;


  context.font =
    '12px Arial, sans-serif';


  (
    order.items || []
  ).forEach(
    (item, index) => {

      context.textAlign =
        'left';


      context.fillText(
        `${index + 1}. ${item.name}`,
        20,
        y
      );


      context.textAlign =
        'center';


      context.fillText(
        String(item.qty),
        width - 150,
        y
      );


      context.textAlign =
        'right';


      context.fillText(
        Number(item.price) === 0
          ? 'FREE'
          : rupee(item.price),
        width - 95,
        y
      );


      context.fillText(
        Number(item.price) === 0
          ? 'FREE'
          : rupee(
              Number(item.price) *
              Number(item.qty)
            ),
        width - 20,
        y
      );


      y += rowHeight;
    }
  );


  divider(y);

  y += 24;


  context.textAlign =
    'left';

  context.font =
    '13px Arial, sans-serif';


  context.fillText(
    'Sub Total',
    20,
    y
  );


  context.textAlign =
    'right';


  context.fillText(
    rupee(order.total),
    width - 20,
    y
  );


  y += 20;


  divider(
    y,
    true
  );


  y += 22;


  context.textAlign =
    'left';


  context.font =
    'bold 17px Arial, sans-serif';


  context.fillText(
    'GRAND TOTAL',
    20,
    y
  );


  context.textAlign =
    'right';


  context.fillText(
    rupee(order.total),
    width - 20,
    y
  );


  y += 20;


  divider(
    y,
    true
  );


  y += 20;


  context.textAlign =
    'center';


  context.font =
    'italic 11px Arial, sans-serif';


  context.fillStyle =
    '#4b5563';


  context.fillText(
    `(${amountInWords(order.total)})`,
    width / 2,
    y
  );


  y += 24;


  context.fillStyle =
    '#111827';


  context.font =
    'bold 14px Arial, sans-serif';


  context.fillText(
    'Thank You! Visit Again!',
    width / 2,
    y
  );


  y += 20;


  divider(y);

  y += 18;


  context.textAlign =
    'left';


  context.font =
    'bold 11px Arial, sans-serif';


  context.fillText(
    'OPENING HOURS:',
    20,
    y
  );


  y += 16;


  context.font =
    '11px Arial, sans-serif';


  context.fillStyle =
    '#4b5563';


  SHOP_INFO.hoursLines
    .forEach(
      hour => {

        context.fillText(
          hour,
          20,
          y
        );

        y += 15;
      }
    );


  context.fillStyle =
    '#111827';


  context.font =
    'bold 11px Arial, sans-serif';


  context.textAlign =
    'center';


  y += 6;


  context.fillText(
    'DINE IN  |  TAKE AWAY  |  HOME DELIVERY',
    width / 2,
    y
  );


  y += 16;


  divider(
    y,
    true
  );


  y += 24;


  if (order.upiLink) {

    context.font =
      'bold 13px Arial, sans-serif';


    context.fillText(
      '📲 SCAN TO PAY',
      width / 2,
      y
    );


    y += 20;


    try {

      if (
        typeof QRCode !==
        'undefined'
      ) {

        const qrDataUrl =
          await QRCode.toDataURL(
            order.upiLink,
            {
              width:
                qrSize * 2,
              margin: 1
            }
          );


        const qrImage =
          await loadImageEl(
            qrDataUrl
          );


        context.drawImage(
          qrImage,
          (width - qrSize) / 2,
          y,
          qrSize,
          qrSize
        );

      }

    } catch (error) {

      context.font =
        '11px Arial, sans-serif';

      context.fillStyle =
        '#9ca3af';

      context.fillText(
        '(QR unavailable — use Pay Now link)',
        width / 2,
        y + qrSize / 2
      );
    }


    y +=
      qrSize +
      14;


    context.font =
      '11px Arial, sans-serif';


    context.fillStyle =
      '#6b7280';


    context.fillText(
      'Works with GPay · PhonePe · Paytm · any UPI app',
      width / 2,
      y
    );


    y += 22;

  } else {

    context.font =
      '11px Arial, sans-serif';


    context.fillStyle =
      '#9ca3af';


    context.fillText(
      'Online payment coming soon — please pay at the counter',
      width / 2,
      y
    );


    y += 20;
  }


  divider(y);

  y += 24;


  context.font =
    'bold 13px Arial, sans-serif';


  context.fillStyle =
    '#111827';


  context.fillText(
    'Enjoyed your meal?',
    width / 2,
    y
  );


  y += 24;


  context.font =
    '22px Arial, sans-serif';


  context.fillText(
    '⭐ ⭐ ⭐ ⭐ ⭐',
    width / 2,
    y
  );


  y += 22;


  context.font =
    '11px Arial, sans-serif';


  context.fillStyle =
    '#6b7280';


  context.fillText(
    'We would love to hear your feedback!',
    width / 2,
    y
  );


  y += 26;


  context.font =
    'italic 12px Arial, sans-serif';


  context.fillText(
    'Thank you for dining with us — visit again soon!',
    width / 2,
    y
  );


  return new Promise(
    resolve =>
      canvas.toBlob(
        resolve,
        'image/png'
      )
  );
}


function blobToBase64(
  blob
) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();


      reader.onloadend =
        () =>
          resolve(
            reader.result
          );


      reader.onerror =
        reject;


      reader.readAsDataURL(
        blob
      );
    }
  );
}


async function sendBillSms(
  order,
  mobile
) {

  const greeting =
    order.customerName
      ? `Dear ${order.customerName}`
      : 'Dear Customer';


  const message =
    order.paymentMethod === 'gpay'

      ? `${greeting}, thank you for visiting ${SHOP_INFO.name}! Your Bill No ${formatBillCode(order)} amount ${rupee(order.total)} has been received via GPay. Visit again soon!`

      : `${greeting}, thank you for visiting ${SHOP_INFO.name}! Your Bill No ${formatBillCode(order)} amount is ${rupee(order.total)}. Pay now: ${buildPayLink(order)} Visit again soon!`;


  try {

    await api(
      '/api/send-sms',
      {
        method: 'POST',

        body:
          JSON.stringify({
            mobile,
            message
          })
      }
    );


    return {
      ok: true
    };


  } catch (error) {

    return {
      ok: false,
      error:
        error.message
    };
  }
}


async function sendBillWhatsAppPhoto(
  order,
  mobile
) {

  let blob;


  try {

    blob =
      await generateBillImageBlob(
        order
      );

  } catch (error) {

    return {
      result: 'failed',
      error:
        error.message
    };
  }


  try {

    const imageBase64 =
      await blobToBase64(
        blob
      );


    await api(
      '/api/send-whatsapp-bill',
      {
        method: 'POST',

        body:
          JSON.stringify({
            billNo:
              order.billNo,

            mobile,

            imageBase64
          })
      }
    );


    return {
      result: 'sent'
    };


  } catch (error) {

    console.warn(
      'Server WhatsApp send failed:',
      error.message
    );
  }


  try {

    const file =
      new File(
        [
          blob
        ],
        `bill-${order.billNo}.png`,
        {
          type:
            'image/png'
        }
      );


    if (
      navigator.canShare &&
      navigator.canShare({
        files: [file]
      })
    ) {

      await navigator.share({

        files: [file],

        title:
          `Bill #${order.billNo}`,

        text:
          `${SHOP_INFO.name} — Bill #${order.billNo} — ${rupee(order.total)}`
      });


      return {
        result: 'shared'
      };
    }


    const url =
      URL.createObjectURL(
        blob
      );


    const anchor =
      document.createElement(
        'a'
      );


    anchor.href =
      url;


    anchor.download =
      `bill-${order.billNo}.png`;


    document.body.appendChild(
      anchor
    );


    anchor.click();


    anchor.remove();


    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),
      4000
    );


    return {
      result: 'downloaded'
    };


  } catch (error) {

    if (
      error?.name ===
      'AbortError'
    ) {

      return {
        result:
          'cancelled'
      };
    }


    return {
      result:
        'failed',
      error:
        error.message
    };
  }
}


/* =========================================================
   INIT
   ========================================================= */

applyThermalPageStyle();

boot();
