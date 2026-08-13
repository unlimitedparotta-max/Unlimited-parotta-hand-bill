const { sendBillEmail } = require('../services/emailService');

/* Stub — Step 9 "Future Ready". Returns a clear, honest error rather
   than a silent no-op, so the frontend (once it calls this) shows a real
   message instead of looking broken. */
async function sendEmailBill(req, res) {
  try {
    await sendBillEmail();
    res.json({ ok: true });
  } catch (e) {
    res.status(501).json({ error: e.message });
  }
}

module.exports = { sendEmailBill };
