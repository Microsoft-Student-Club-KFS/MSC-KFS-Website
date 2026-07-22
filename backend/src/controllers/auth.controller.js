const db = require('../config/db');
const { comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');

async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const result = await db.query(
    `SELECT id, username, password_hash, full_name, email, account_status
     FROM users WHERE username = $1`,
    [username]
  );

  const user = result.rows[0];

  // Same generic error whether the username is unknown or the password is
  // wrong, so the response does not reveal which usernames exist.
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const passwordMatches = await comparePassword(password, user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  if (user.account_status !== 'active') {
    return res.status(403).json({ error: 'This account is not active' });
  }

  const token = signToken(user);

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
    },
  });
}

async function me(req, res) {
  const rolesResult = await db.query(
    `SELECT r.code AS role_code, r.name AS role_name, ur.scope_type, ur.scope_id
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [req.user.id]
  );

  return res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      full_name: req.user.full_name,
      email: req.user.email,
      account_status: req.user.account_status,
    },
    roles: rolesResult.rows.map((row) => ({
      code: row.role_code,
      name: row.role_name,
      scopeType: row.scope_type,
      scopeId: row.scope_id,
    })),
  });
}

module.exports = { login, me };
