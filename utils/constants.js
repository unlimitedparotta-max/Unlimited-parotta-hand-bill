// Central place for shop details and shared limits/config used across the
// app. Change your shop info here once — the bill page, PDF, and message
// templates all read from this file.
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || '/tmp';
const DB_PATH = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/tmp/uploads';
const SHOP_INFO = {
  name: 'UNLIMITED PAROTTA',
  tagline: 'Taste Unlimited. Happiness Unlimited.',
  addressLines: [
    '14, Rani Paradise Theater Complex,',
    'Membalam Rd, Pandiyar Residency,',
    'Thanjavur, India, 613007'
  ],
  phone: '+91 91234 56789',
  logoUrl: process.env.SHOP_LOGO_URL || '',
  reviewLink: process.env.SHOP_REVIEW_LINK || ''
};

const PAYMENT_LABELS = { cash: 'Cash', gpay: 'UPI / GPay' };

const ALLOWED_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

module.exports = {
  DATA_DIR, DB_PATH, UPLOAD_DIR,
  SHOP_INFO, PAYMENT_LABELS, ALLOWED_IMAGE_EXT,
  SESSION_MS, MAX_LOGIN_ATTEMPTS, LOCKOUT_MS
};
