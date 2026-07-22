const db = require('../config/db');
const httpError = require('../utils/httpError');

async function list(req, res) {
  const result = await db.query(
    `SELECT d.id, d.code, d.name, d.description, d.is_active, d.whatsapp_link AS "whatsappLink",
       CASE WHEN EXISTS (
         SELECT 1 FROM user_roles ur_scope
         WHERE ur_scope.user_id = $1 AND (
           ur_scope.scope_type = 'global'
           OR (ur_scope.scope_type = 'department' AND ur_scope.scope_id = d.id)
           OR (ur_scope.scope_type = 'unit' AND ur_scope.scope_id IN (SELECT id FROM units WHERE department_id = d.id))
           OR (ur_scope.scope_type = 'group' AND ur_scope.scope_id IN (SELECT g.id FROM groups g JOIN units u ON g.unit_id = u.id WHERE u.department_id = d.id))
         )
       ) THEN (
         SELECT COALESCE(json_agg(json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email)), '[]')
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id AND r.code = 'department_director'
         JOIN users u ON u.id = ur.user_id
         WHERE ur.scope_type = 'department' AND ur.scope_id = d.id
       ) ELSE '[]'::json END AS directors
     FROM departments d
     ORDER BY d.name`,
    [req.user.id]
  );
  res.json({ departments: result.rows });
}

async function create(req, res) {
  const { code, name, description, whatsappLink } = req.body;
  if (!code || !name) {
    throw httpError(400, 'code and name are required');
  }

  const result = await db.query(
    `INSERT INTO departments (code, name, description, whatsapp_link) VALUES ($1, $2, $3, $4) RETURNING *`,
    [code, name, description || null, whatsappLink || null]
  );
  res.status(201).json({ department: result.rows[0] });
}

async function update(req, res) {
  const { id } = req.params;
  const { name, description, isActive, whatsappLink } = req.body;

  const existing = await db.query('SELECT id FROM departments WHERE id = $1', [id]);
  if (!existing.rows.length) throw httpError(404, 'Department not found');

  const result = await db.query(
    `UPDATE departments
     SET name        = COALESCE($1, name),
         description = COALESCE($2, description),
         is_active   = COALESCE($3, is_active),
         whatsapp_link = CASE WHEN $4::boolean THEN $5 ELSE whatsapp_link END
     WHERE id = $6
     RETURNING *`,
    [name || null, description ?? null, isActive ?? null,
     whatsappLink !== undefined, whatsappLink || null, id]
  );
  res.json({ department: result.rows[0] });
}

module.exports = { list, create, update };
