/* Strips everything but digits and validates length. Used everywhere a
   customer mobile number comes in from a request body (orders, SMS,
   WhatsApp) so the same rule applies consistently. */
function cleanMobile(raw) {
  return String(raw || '').replace(/\D/g, '');
}
function isValidMobile(raw) {
  const clean = cleanMobile(raw);
  return clean.length >= 10 && clean.length <= 15;
}

module.exports = { cleanMobile, isValidMobile };
