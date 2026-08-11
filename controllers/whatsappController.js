const { readDb, findOrderByCode } = require('../services/orderService');
const { deliverBillViaWhatsApp } = require('../services/notificationService');
const { cleanMobile, isValidMobile } = require('../utils/mobileFormatter');

/* POST /api/send-whatsapp-bill — Step 2.
   Looks up the order server-side (so the message always matches what was
   actually saved) and sends the bill LINK as a WhatsApp text message.
   No image, no upload, no base64. */
async function sendWhatsAppBill(req, res) {
  const mobile = cleanMobile(req.body && req.body.mobile);
  const billCode = req.body && req.body.billCode;
  if (!isValidMobile(mobile)) return res.status(400).json({ error: 'Enter a valid mobile number' });
  if (!billCode) return res.status(400).json({ error: 'Missing bill code' });

  const db = readDb();
  const order = findOrderByCode(db, billCode);
  if (!order) return res.status(404).json({ error: 'Bill not found' });

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const result = await deliverBillViaWhatsApp(order, mobile, baseUrl);
  if (!result.ok) return res.status(502).json({ error: result.error });
  res.json({ ok: true });
}

module.exports = { sendWhatsAppBill };
