const crypto = require('crypto');
const { SESSION_MS } = require('../utils/constants');

/* ---------------- PIN hashing (scrypt, no extra dependency) ---------------- */
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPin(pin, stored) {
  if (!stored) return false;
  if (!stored.startsWith('scrypt$')) return stored === pin; // legacy plaintext, migrated on next successful login
  const [, salt, hash] = stored.split('$');
  const check = crypto.scryptSync(String(pin), salt, 32).toString('hex');
  const a = Buffer.from(hash, 'hex'), b = Buffer.from(check, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------------- signed, expiring tokens ----------------
   Tokens are self-contained (role + expiry) and HMAC-signed, so auth
   survives server restarts / cold starts instead of relying on an
   in-memory Map that's wiped every time the process restarts (which
   happens on every request on serverless platforms like Vercel).
   Set TOKEN_SECRET in your environment for production; otherwise a
   secret is generated once and persisted in db.json. */
const revoked = new Set(); // best-effort logout revocation (per-instance)
let cachedSecret = null;

function getSecret() {
  if (cachedSecret) return cachedSecret;
  if (process.env.TOKEN_SECRET) { cachedSecret = process.env.TOKEN_SECRET; return cachedSecret; }
  // Lazy require to avoid a circular require with orderService at module-load time.
  const { readDb, writeDb } = require('../services/orderService');
  const db = readDb();
  if (!db.secret) {
    db.secret = crypto.randomBytes(32).toString('hex');
    writeDb(db);
  }
  cachedSecret = db.secret;
  return cachedSecret;
}

function createToken(role) {
  const payload = { role, exp: Date.now() + SESSION_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyToken(token) {
  if (!token || typeof token !== 'string' || revoked.has(token)) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload.role;
  } catch { return null; }
}
function revokeToken(token) { revoked.add(token); }

/* Express middleware: requires a valid X-Token header, sets req.role. */
function auth(req, res, next) {
  const token = req.headers['x-token'];
  const role = verifyToken(token);
  if (!role) return res.status(401).json({ error: 'Not logged in' });
  req.role = role;
  req.token = token;
  next();
}

module.exports = { auth, hashPin, verifyPin, createToken, verifyToken, revokeToken };
