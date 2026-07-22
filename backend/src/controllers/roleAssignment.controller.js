const db = require('../config/db');
const httpError = require('../utils/httpError');
const { scopeAllows, hasGlobalScope } = require('../utils/scope');

// Which scope type a given role is allowed to be assigned at. Keeps the
// hierarchy honest: a Mentor role scoped to a whole department would not
// make sense, for example.
const ROLE_SCOPE_MAP = {
  full_access: 'global',
  department_director: 'department',
  unit_lead: 'unit',
  unit_vice_lead: 'unit',
  team_member: 'unit',
  mentor: 'group',
  member: 'group',
};

async function resolveTarget(scopeType, scopeId) {
  if (scopeType === 'department') {
    const r = await db.query('SELECT id FROM departments WHERE id = $1', [scopeId]);
    if (!r.rows.length) throw httpError(404, 'Department not found');
    return { departmentId: scopeId };
  }
  if (scopeType === 'unit') {
    const r = await db.query('SELECT id, department_id FROM units WHERE id = $1', [scopeId]);
    if (!r.rows.length) throw httpError(404, 'Unit not found');
    return { departmentId: r.rows[0].department_id, unitId: scopeId };
  }
  if (scopeType === 'group') {
    const r = await db.query(
      `SELECT g.id, g.unit_id, un.department_id
       FROM groups g JOIN units un ON un.id = g.unit_id WHERE g.id = $1`,
      [scopeId]
    );
    if (!r.rows.length) throw httpError(404, 'Group not found');
    return { departmentId: r.rows[0].department_id, unitId: r.rows[0].unit_id, groupId: scopeId };
  }
  return {};
}

async function list(req, res) {
  const { scopeType, scopeId } = req.query;
  if (!scopeType || !scopeId) {
    throw httpError(400, 'scopeType and scopeId are required');
  }

  const target = scopeType === 'global' ? {} : await resolveTarget(scopeType, scopeId);

  if (scopeType === 'global') {
    if (!hasGlobalScope(req.permissionScopes)) {
      throw httpError(403, 'Only a global Full Access holder can list global role assignments');
    }
  } else if (!scopeAllows(req.permissionScopes, target)) {
    throw httpError(403, 'You are not authorized to view role assignments at this scope');
  }

  const result = await db.query(
    `SELECT ur.id, ur.user_id, u.full_name, u.email, r.code AS role_code, r.name AS role_name, ur.assigned_at
     FROM user_roles ur
     JOIN users u ON u.id = ur.user_id
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.scope_type = $1 AND ur.scope_id = $2
     ORDER BY ur.assigned_at DESC`,
    [scopeType, scopeId]
  );
  res.json({ assignments: result.rows });
}

async function assign(req, res) {
  const { userId, roleCode, scopeType, scopeId } = req.body;

  if (!userId || !roleCode || !scopeType) {
    throw httpError(400, 'userId, roleCode and scopeType are required');
  }
  if (scopeType !== 'global' && !scopeId) {
    throw httpError(400, 'scopeId is required for a non-global scope');
  }
  if (ROLE_SCOPE_MAP[roleCode] !== scopeType) {
    throw httpError(400, `Role '${roleCode}' must be assigned at scope '${ROLE_SCOPE_MAP[roleCode] || 'unknown'}'`);
  }

  const target = scopeType === 'global' ? {} : await resolveTarget(scopeType, scopeId);

  if (scopeType === 'global') {
    if (!hasGlobalScope(req.permissionScopes)) {
      throw httpError(403, 'Only a global Full Access holder can assign a global role');
    }
  } else if (!scopeAllows(req.permissionScopes, target)) {
    throw httpError(403, 'You are not authorized to assign roles at this scope');
  }

  const role = await db.query('SELECT id FROM roles WHERE code = $1', [roleCode]);
  if (!role.rows.length) throw httpError(404, 'Role not found');

  const user = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
  if (!user.rows.length) throw httpError(404, 'User not found');

  const duplicate = await db.query(
    `SELECT id FROM user_roles
     WHERE user_id = $1 AND role_id = $2 AND scope_type = $3
       AND ((scope_id IS NULL AND $4::uuid IS NULL) OR scope_id = $4)`,
    [userId, role.rows[0].id, scopeType, scopeId || null]
  );
  if (duplicate.rows.length) throw httpError(409, 'This user already holds this role at this scope');

  const result = await db.query(
    `INSERT INTO user_roles (user_id, role_id, scope_type, scope_id)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, role.rows[0].id, scopeType, scopeId || null]
  );
  res.status(201).json({ assignment: result.rows[0] });
}

async function revoke(req, res) {
  const { id } = req.params;

  const existing = await db.query('SELECT * FROM user_roles WHERE id = $1', [id]);
  if (!existing.rows.length) throw httpError(404, 'Assignment not found');

  const row = existing.rows[0];
  const target = row.scope_type === 'global' ? {} : await resolveTarget(row.scope_type, row.scope_id);

  if (row.scope_type === 'global') {
    if (!hasGlobalScope(req.permissionScopes)) {
      throw httpError(403, 'Only a global Full Access holder can revoke a global role');
    }
  } else if (!scopeAllows(req.permissionScopes, target)) {
    throw httpError(403, 'You are not authorized to revoke roles at this scope');
  }

  await db.query('DELETE FROM user_roles WHERE id = $1', [id]);
  res.status(204).send();
}

module.exports = { list, assign, revoke };
