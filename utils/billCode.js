const crypto = require('crypto');

/* Every order gets a permanent, shareable code like UP260802A1B2C3 — a
   date prefix (for readability/sorting) plus a random, unguessable suffix.
   Deliberately NOT a simple counter: a sequential ID would let anyone
   enumerate other customers' bills by changing a number in the URL. */
function generateBillCode(dateObj) {
  const yy = String(dateObj.getFullYear()).slice(-2);
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
  return `UP${yy}${mm}${dd}${rand}`;
}

module.exports = { generateBillCode };
