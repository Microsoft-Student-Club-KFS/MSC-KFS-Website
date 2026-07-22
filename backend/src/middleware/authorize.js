const db = require('../config/db');

// Loads every permission the current user holds, together with the scope
// each one applies to. Must run after `authenticate`.
async function loadPermissions(req, res, next) {
  const result = await db.query(
    `SELECT p.code AS permission_code,
            ur.scope_type,
            ur.scope_id,
            r.code AS role_code
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     JOIN role_permissions rp ON rp.role_id = r.id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1`,
    [req.user.id]
  );

  const permissions = new Map();
  for (const row of result.rows) {
    const entry = {
      scopeType: row.scope_type,
      scopeId: row.scope_id,
      roleCode: row.role_code,
    };
    if (!permissions.has(row.permission_code)) {
      permissions.set(row.permission_code, []);
    }
    permissions.get(row.permission_code).push(entry);
  }

  req.user.permissions = permissions;
  next();
}

// Returns middleware that rejects the request unless the user holds
// `permissionCode` in at least one scope. The matching scope entries are
// attached to req.permissionScopes so route handlers can filter data
// accordingly (e.g. restrict results to the caller's department).
function requirePermission(permissionCode) {
  return (req, res, next) => {
    const scopes = req.user.permissions ? req.user.permissions.get(permissionCode) : null;

    if (!scopes || scopes.length === 0) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }

    req.permissionScopes = scopes;
    next();
  };
}

// Convenience check for handlers that need it without the middleware form.
function hasGlobalScope(scopes) {
  return Array.isArray(scopes) && scopes.some((s) => s.scopeType === 'global');
}

module.exports = { loadPermissions, requirePermission, hasGlobalScope };
