const { readDb } = require('../services/orderService');
const { buildUpiRawLink } = require('../utils/upi');

/* ---------------- UPI pay page ----------------
   SMS and WhatsApp apps only auto-linkify http(s) URLs, not raw
   "upi://" links, so we host a tiny redirect page here instead. The
   message contains a normal https link to this page; the page itself
   immediately redirects into the customer's UPI app (GPay/PhonePe/etc.)
   with the amount pre-filled, with a manual button as a fallback.
   Requires env vars once you have a UPI ID:
     UPI_ID          - your UPI ID / VPA, e.g. 'yourshop@okaxis'
     UPI_PAYEE_NAME  - (optional) name shown in the UPI app, defaults to shop name */
function payPage(req, res) {
  const billNo = Number(req.params.billNo);
  const db = readDb();
  const order = db.orders.find(o => o.billNo === billNo);
  if (!order) return res.status(404).send('Bill not found.');

  const payeeName = process.env.UPI_PAYEE_NAME || 'Unlimited Parotta';
  const upiLink = buildUpiRawLink(order);

  if (!upiLink) {
    return res.status(503).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="font-family:sans-serif;text-align:center;padding:60px 20px;">
        <h2>Online payment isn't set up yet</h2>
        <p>Please pay at the counter for Bill #${order.billNo} (₹${order.total}).</p>
      </body></html>`);
  }

  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Pay Bill #${order.billNo}</title>
    <meta http-equiv="refresh" content="0;url=${upiLink}">
    <style>
      body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:50px 20px;background:#111827;color:#fff;}
      .amt{font-size:32px;font-weight:800;margin:10px 0;}
      .btn{display:inline-block;margin-top:22px;padding:14px 30px;background:#25D366;color:#111827;text-decoration:none;border-radius:10px;font-weight:700;}
      .hint{color:#9ca3af;font-size:13px;margin-top:26px;}
    </style></head>
    <body>
      <div>${payeeName}</div>
      <div>Bill #${order.billNo}</div>
      <div class="amt">₹${order.total}</div>
      <a class="btn" href="${upiLink}">Tap to Pay via UPI</a>
      <div class="hint">Redirecting to your UPI app… if nothing happens, tap the button above.</div>
    </body></html>`);
}

// Not secret — a UPI ID/payee name is exactly what a customer would see on
// a printed QR code anyway. Lets the browser build the "Scan to Pay" QR
// locally (no payment gateway, no server round-trip per bill).
function upiConfig(req, res) {
  res.json({
    upiId: process.env.UPI_ID || '',
    payeeName: process.env.UPI_PAYEE_NAME || 'Unlimited Parotta'
  });
}

module.exports = { payPage, upiConfig };
