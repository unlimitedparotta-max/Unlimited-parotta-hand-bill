/* ---------------- SMS (MSG91) ----------------
   Unchanged from before this restructure — moved here as-is.
   Requires env vars once you have an MSG91 account + DLT-approved template:
     MSG91_AUTH_KEY        - your MSG91 auth key
     MSG91_SENDER_ID       - your approved 6-letter sender id (e.g. UNLPRT)
     MSG91_DLT_TEMPLATE_ID - the DLT template id approved for the message below
     MSG91_DLT_ENTITY_ID   - (optional) your DLT principal entity id, if MSG91 asks for it
   The message text sent here MUST match your approved DLT template wording,
   or telecom carriers will silently block it. See README for setup steps. */
async function sendSmsViaMsg91(mobile, message) {
  const authkey = process.env.MSG91_AUTH_KEY;
  const sender = process.env.MSG91_SENDER_ID;
  if (!authkey || !sender) {
    throw new Error('SMS is not set up yet. Add MSG91_AUTH_KEY and MSG91_SENDER_ID to your .env file.');
  }
  const params = new URLSearchParams({
    authkey,
    mobiles: '91' + mobile,
    message,
    sender,
    route: process.env.MSG91_ROUTE || '4',
    country: '91'
  });
  if (process.env.MSG91_DLT_TEMPLATE_ID) params.set('DLT_TE_ID', process.env.MSG91_DLT_TEMPLATE_ID);
  if (process.env.MSG91_DLT_ENTITY_ID) params.set('DLT_PE_ID', process.env.MSG91_DLT_ENTITY_ID);

  const resp = await fetch(`https://api.msg91.com/api/sendhttp.php?${params.toString()}`);
  const text = await resp.text();
  if (!resp.ok || /error/i.test(text)) throw new Error('SMS provider error: ' + text);
  return text;
}

module.exports = { sendSmsViaMsg91 };
