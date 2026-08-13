const QRCode = require('qrcode');

/* Thin wrapper around the `qrcode` package — not called anywhere yet
   (the GPay QR is currently generated client-side in the browser), but
   ready for server-side QR needs, e.g. Step 4's "Show QR Code" fallback
   or a printed feedback QR on the bill page. */
async function generateQrDataUrl(text, opts = {}) {
  return QRCode.toDataURL(text, { width: 220, margin: 1, ...opts });
}

module.exports = { generateQrDataUrl };
