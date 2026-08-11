/* ---------------- Email delivery (not built yet — Step 9 "Future Ready") ----------------
   Stubbed so routes/controllers can already call this shape without
   changing their code once email is actually implemented (SendGrid,
   Resend, SES, etc. would all slot in here). templates/emailTemplate.html
   is ready and waiting for this. */
async function sendBillEmail(/* email, order, baseUrl */) {
  throw new Error('Email delivery is not set up yet — planned for a future step.');
}

module.exports = { sendBillEmail };
