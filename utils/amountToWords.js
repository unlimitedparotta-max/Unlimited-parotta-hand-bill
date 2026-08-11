/* Whole-rupee amount in words (Indian numbering: Lakh/Crore), e.g.
   490 -> "Rupees Four Hundred Ninety Only". Menu prices are always whole
   rupees in this app, so paise are not handled. */
function numberToWordsIndian(numIn) {
  let num = Math.round(numIn);
  if (num === 0) return 'Rupees Zero Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const twoDigits = n => (n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''));
  const threeDigits = n => (n < 100 ? twoDigits(n) : ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : ''));
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  const rest = num;
  const parts = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(threeDigits(lakh) + ' Lakh');
  if (thousand) parts.push(threeDigits(thousand) + ' Thousand');
  if (rest) parts.push(threeDigits(rest));
  return 'Rupees ' + parts.join(' ') + ' Only';
}
function formatAmt(n) { return Number(n).toFixed(2); }
function formatDateOnly(iso) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}
function formatTimeOnly(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

module.exports = { numberToWordsIndian, formatAmt, formatDateOnly, formatTimeOnly };
