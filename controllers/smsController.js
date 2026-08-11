const { sendSmsViaMsg91 } = require('../services/smsService');

/* POST /api/send-sms — unchanged behavior from before this restructure
   (message text is still built client-side in public/app.js for now). */
async function sendSms(req, res) {
  const clean = String((req.body && req.body.mobile) || '').replace(/\D/g, '');
  const message = String((req.body && req.body.message) || '').trim();
  if (clean.length < 10) return res.status(400).json({ error: 'Enter a valid mobile number' });
  if (!message) return res.status(400).json({ error: 'Message is empty' });
  try {
    await sendSmsViaMsg91(clean, message);
    res.json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}

module.exports = { sendSms };
