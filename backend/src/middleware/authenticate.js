const { verifyToken } = require('../utils/jwt');
const db = require('../config/db');

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication token is missing' });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const result = await db.query(
    `SELECT id, username, full_name, email, account_status
     FROM users WHERE id = $1`,
    [payload.sub]
  );

  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ error: 'User no longer exists' });
  }

  if (user.account_status !== 'active') {
    return res.status(403).json({ error: 'Account is not active' });
  }

  req.user = user;
  next();
}

module.exports = authenticate;
