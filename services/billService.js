const fs = require('fs');
const path = require('path');
const { SHOP_INFO, PAYMENT_LABELS } = require('../utils/constants');
const { formatAmt, formatDateOnly, formatTimeOnly, numberToWordsIndian } = require('../utils/amountToWords');

const BILL_TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'bill.html');
const WHATSAPP_TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'whatsappTemplate.json');

/* Fills {{token}} placeholders in a template string. Unknown tokens are
   left as-is rather than throwing, so a template can be edited without
   the app needing to know about every field in advance. */
function fillTemplate(str, values) {
  return str.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in values ? values[key] : m));
}

function buildBillLink(order, baseUrl) {
  return `${baseUrl}/bill/${order.billCode || order.billNo}`;
}

/* The WhatsApp message text — loaded from templates/whatsappTemplate.json
   so the wording can be tweaked without touching code. This is the exact
   template you approved: shop name, thank-you, bill number, amount, and
   the bill link — no image, no attachment. */
function buildBillWhatsAppMessage(order, baseUrl) {
  const raw = JSON.parse(fs.readFileSync(WHATSAPP_TEMPLATE_PATH, 'utf8'));
  return fillTemplate(raw.billReady, {
    shopName: SHOP_INFO.name,
    billCode: order.billCode || String(order.billNo),
    amount: formatAmt(order.total),
    billLink: buildBillLink(order, baseUrl)
  });
}

/* Renders the customer-facing digital bill page from templates/bill.html.
   Mobile-responsive, no login required — this is what /bill/:code serves. */
function renderBillHtml(order, baseUrl) {
  const rows = order.items.map((it, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${it.name}</td>
      <td class="num">${it.qty}</td>
      <td class="num">${it.price === 0 ? 'FREE' : formatAmt(it.price)}</td>
      <td class="num">${it.price === 0 ? 'FREE' : formatAmt(it.price * it.qty)}</td>
    </tr>`).join('');

  const template = fs.readFileSync(BILL_TEMPLATE_PATH, 'utf8');
  return fillTemplate(template, {
    pageTitle: `Bill ${order.billCode || order.billNo} — ${SHOP_INFO.name}`,
    logoBlock: SHOP_INFO.logoUrl ? `<div style="text-align:center;margin-bottom:8px;"><img src="${SHOP_INFO.logoUrl}" alt="${SHOP_INFO.name}" style="max-height:60px;"></div>` : '',
    shopName: SHOP_INFO.name,
    tagline: SHOP_INFO.tagline,
    addressBlock: SHOP_INFO.addressLines.map(l => `<div class="addr">${l}</div>`).join(''),
    phoneBlock: SHOP_INFO.phone ? `<div class="addr">Ph: ${SHOP_INFO.phone}</div>` : '',
    billCode: order.billCode || order.billNo,
    date: formatDateOnly(order.time),
    time: formatTimeOnly(order.time),
    tableRow: order.note ? `<div><span class="lbl">Table No</span><span>${order.note}</span></div>` : '',
    paymentLabel: PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod,
    customerRow: order.customerName ? `<div><span class="lbl">Customer</span><span>${order.customerName}</span></div>` : '',
    mobileRow: order.customerMobile ? `<div><span class="lbl">Mobile</span><span>${order.customerMobile}</span></div>` : '',
    itemRows: rows,
    subTotal: formatAmt(order.total),
    grandTotal: formatAmt(order.total),
    amountWords: numberToWordsIndian(order.total),
    pdfUrl: `${baseUrl}/bill/${order.billCode || order.billNo}/pdf`,
    reviewBlock: SHOP_INFO.reviewLink ? `<a class="btn btn-outline" href="${SHOP_INFO.reviewLink}">⭐ Rate Us</a>` : ''
  });
}

module.exports = { buildBillLink, buildBillWhatsAppMessage, renderBillHtml };
