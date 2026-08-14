const supabase = require('../supabase');
const { verifyPin, createToken, revokeToken } = require('../middleware/auth');
const { MAX_LOGIN_ATTEMPTS, LOCKOUT_MS } = require('../utils/constants');

/* login brute-force protection */
const loginAttempts = new Map();

function clientIp(req) {
  return (
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

async function login(req, res) {
  const ip = clientIp(req);
  const now = Date.now();

  const rec = loginAttempts.get(ip);

  if (
    rec &&
    rec.count >= MAX_LOGIN_ATTEMPTS &&
    now - rec.lockedAt < LOCKOUT_MS
  ) {
    const waitMin = Math.ceil(
      (LOCKOUT_MS - (now - rec.lockedAt)) / 60000
    );

    return res.status(429).json({
      error: `Too many attempts. Try again in ${waitMin} min.`
    });
  }

  const { role, pin } = req.body || {};

  if (!role || !pin) {
    return res.status(400).json({
      error: 'Role and PIN are required'
    });
  }

  /* Read users permanently from Supabase */
  const { data: user, error } = await supabase
    .from('app_users')
    .select('role, label, pin')
    .eq('role', role)
    .maybeSingle();

  if (error) {
    console.error('Supabase login error:', error);

    return res.status(500).json({
      error: 'Could not verify login'
    });
  }

  const ok = user && verifyPin(String(pin), user.pin);

  console.log('LOGIN DEBUG:', {
    role,
    hasPin: !!pin,
    userFound: !!user,
    verifyResult: !!ok
  });

  if (!ok) {
    const cur = loginAttempts.get(ip) || {
      count: 0,
      lockedAt: 0
    };

    cur.count++;

    if (cur.count >= MAX_LOGIN_ATTEMPTS) {
      cur.lockedAt = now;
    }

    loginAttempts.set(ip, cur);

    return res.status(401).json({
      error: 'Incorrect PIN'
    });
  }

  loginAttempts.delete(ip);

  const token = createToken(role);

  return res.json({
    ok: true,
    token,
    role,
    label: user.label
  });
}

function logout(req, res) {
  revokeToken(req.token);

  res.json({
    ok: true
  });
}

module.exports = {
  login,
  logout
};