const db = require('../config/db');
const httpError = require('../utils/httpError');
const { scopeAllows } = require('../utils/scope');

async function list(req, res) {
  const { departmentId } = req.query;

  const result = await db.query(
    `SELECT un.id, un.code, un.name, un.kind, un.description, un.is_active, un.short_code,
        un.whatsapp_link AS "whatsappLink",
        un.department_id, d.code AS department_code, d.name AS department_name,
        CASE WHEN EXISTS (
          SELECT 1 FROM user_roles ur_scope
          WHERE ur_scope.user_id = $2 AND (
            ur_scope.scope_type = 'global'
            OR (ur_scope.scope_type = 'department' AND ur_scope.scope_id = un.department_id)
            OR (ur_scope.scope_type = 'unit' AND ur_scope.scope_id = un.id)
            OR (ur_scope.scope_type = 'group' AND ur_scope.scope_id IN (SELECT id FROM groups WHERE unit_id = un.id))
          )
        ) THEN (
          SELECT COALESCE(json_agg(json_build_object(
              'id', u.id, 'fullName', u.full_name, 'email', u.email, 'position', r.code
            )), '[]')
           FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id AND r.code IN ('unit_lead', 'unit_vice_lead')
           JOIN users u ON u.id = ur.user_id
           WHERE ur.scope_type = 'unit' AND ur.scope_id = un.id
        ) ELSE '[]'::json END AS leadership
     FROM units un
     JOIN departments d ON d.id = un.department_id
     WHERE $1::uuid IS NULL OR un.department_id = $1
     ORDER BY d.name, un.name`,
    [departmentId || null, req.user.id]
  );
  res.json({ units: result.rows });
}

async function create(req, res) {
  const { departmentId, code, name, kind, description, shortCode, whatsappLink } = req.body;

  if (!departmentId || !code || !name || !kind) {
    throw httpError(400, 'departmentId, code, name and kind are required');
  }
  if (!['track', 'section'].includes(kind)) {
    throw httpError(400, "kind must be 'track' or 'section'");
  }

  if (!scopeAllows(req.permissionScopes, { departmentId })) {
    throw httpError(403, 'You are not authorized to manage units in this department');
  }

  const dept = await db.query('SELECT id FROM departments WHERE id = $1', [departmentId]);
  if (!dept.rows.length) throw httpError(404, 'Department not found');

  const result = await db.query(
    `INSERT INTO units (department_id, code, name, kind, description, short_code, whatsapp_link)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [departmentId, code, name, kind, description || null, shortCode || null, whatsappLink || null]
  );
  res.status(201).json({ unit: result.rows[0] });
}

async function update(req, res) {
  const { id } = req.params;
  const { name, description, isActive, shortCode, whatsappLink } = req.body;

  const existing = await db.query('SELECT id, department_id FROM units WHERE id = $1', [id]);
  if (!existing.rows.length) throw httpError(404, 'Unit not found');

  if (!scopeAllows(req.permissionScopes, { departmentId: existing.rows[0].department_id, unitId: id })) {
    throw httpError(403, 'You are not authorized to manage this unit');
  }

  const result = await db.query(
    `UPDATE units
     SET name         = COALESCE($1, name),
         description  = COALESCE($2, description),
         is_active    = COALESCE($3, is_active),
         short_code   = COALESCE($4, short_code),
         whatsapp_link = CASE WHEN $5::boolean THEN $6 ELSE whatsapp_link END
     WHERE id = $7
     RETURNING *`,
    [name || null, description ?? null, isActive ?? null, shortCode || null,
     whatsappLink !== undefined, whatsappLink || null, id]
  );
  res.json({ unit: result.rows[0] });
}

async function remove(req, res) {
  const { id } = req.params;

  const existing = await db.query('SELECT id, department_id FROM units WHERE id = $1', [id]);
  if (!existing.rows.length) throw httpError(404, 'Unit not found');

  if (!scopeAllows(req.permissionScopes, { departmentId: existing.rows[0].department_id, unitId: id })) {
    throw httpError(403, 'You are not authorized to delete this unit');
  }

  await db.query('DELETE FROM units WHERE id = $1', [id]);
  res.json({ message: 'Unit deleted successfully' });
}

module.exports = { list, create, update, remove };
