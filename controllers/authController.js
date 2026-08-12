const { hashPin, verifyPin, createToken, revokeToken } = require('../middleware/auth');
const { readDb } = require('../services/orderService');
const { MAX_LOGIN_ATTEMPTS, LOCKOUT_MS } = require('../utils/constants');

/* login brute-force protection: lock an IP out after too many bad PINs */
const loginAttempts = new Map(); // ip -> { count, lockedAt }
function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

function login(req, res) {
  const ip = clientIp(req);
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (rec && rec.count >= MAX_LOGIN_ATTEMPTS && now - rec.lockedAt < LOCKOUT_MS) {
    const waitMin = Math.ceil((LOCKOUT_MS - (now - rec.lockedAt)) / 60000);
    return res.status(429).json({ error: `Too many attempts. Try again in ${waitMin} min.` });
  }

 const { role, pin } = req.body || {};
const db = readDb();

console.log('LOGIN DEBUG:', {
  role,
  hasPin: !!pin,
  dbUsers: Object.keys(db.users || {})
});

const user = db.users[role];
  const ok = user && verifyPin(pin, user.pin);

  if (!ok) {
    const cur = loginAttempts.get(ip) || { count: 0, lockedAt: 0 };
    cur.count++;
    if (cur.count >= MAX_LOGIN_ATTEMPTS) cur.lockedAt = now;
    loginAttempts.set(ip, cur);
    return res.status(401).json({ error: 'Incorrect PIN' });
  }
  loginAttempts.delete(ip);

  // migrate legacy plaintext PIN to a hash transparently
  if (!user.pin.startsWith('scrypt$')) {
    user.pin = hashPin(pin);
    require('../services/orderService').writeDb(db);
  }

  const token = createToken(role);
  res.json({ ok: true, token, role, label: user.label });
}

function logout(req, res) {
  revokeToken(req.token);
  res.json({ ok: true });
}

module.exports = { login, logout };
