/* Builds the raw NPCI "upi://pay?..." URI — this exact format is what
   GPay/PhonePe/Paytm's own QR scanners and app-links recognize natively
   and jump straight into the payment screen for. Returns null if UPI
   isn't configured yet (UPI_ID env var missing) so callers can show a
   "not set up" message instead of a broken link. */
function buildUpiRawLink(order) {
  const upiId = process.env.UPI_ID;
  if (!upiId) return null;
  const payeeName = process.env.UPI_PAYEE_NAME || 'Unlimited Parotta';
  return `upi://pay?${new URLSearchParams({
    pa: upiId, pn: payeeName, am: String(order.total), cu: 'INR', tn: `Bill ${order.billNo}`
  }).toString()}`;
}

module.exports = { buildUpiRawLink };
