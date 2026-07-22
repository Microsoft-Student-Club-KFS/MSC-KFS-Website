const db = require('../config/db');
const httpError = require('../utils/httpError');
const { scopeAllows } = require('../utils/scope');

async function list(req, res) {
  const { unitId } = req.query;

  const result = await db.query(
    `SELECT g.id, g.code, g.name, g.capacity, g.is_active,
        g.whatsapp_link AS "whatsappLink",
        g.unit_id, un.name AS unit_name, un.department_id,
        CASE WHEN EXISTS (
          SELECT 1 FROM user_roles ur_scope
          WHERE ur_scope.user_id = $2 AND (
            ur_scope.scope_type = 'global'
            OR (ur_scope.scope_type = 'department' AND ur_scope.scope_id = un.department_id)
            OR (ur_scope.scope_type = 'unit' AND ur_scope.scope_id = g.unit_id)
            OR (ur_scope.scope_type = 'group' AND ur_scope.scope_id = g.id)
          )
        ) THEN (
          SELECT COALESCE(json_agg(json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email)), '[]')
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id AND r.code = 'mentor'
          JOIN users u ON u.id = ur.user_id
          WHERE ur.scope_type = 'group' AND ur.scope_id = g.id
        ) ELSE '[]'::json END AS mentors,
        (SELECT count(*)::int FROM member_enrollments me WHERE me.group_id = g.id AND me.status = 'active') AS active_member_count
     FROM groups g
     JOIN units un ON un.id = g.unit_id
     WHERE $1::uuid IS NULL OR g.unit_id = $1
     ORDER BY un.name, g.name`,
    [unitId || null, req.user.id]
  );
  res.json({ groups: result.rows });
}

async function create(req, res) {
  const { unitId, code, name, capacity, whatsappLink } = req.body;

  if (!unitId || !code || !name) {
    throw httpError(400, 'unitId, code and name are required');
  }

  const unit = await db.query('SELECT id, department_id FROM units WHERE id = $1', [unitId]);
  if (!unit.rows.length) throw httpError(404, 'Unit not found');

  if (!scopeAllows(req.permissionScopes, { departmentId: unit.rows[0].department_id, unitId })) {
    throw httpError(403, 'You are not authorized to manage groups in this unit');
  }

  const result = await db.query(
    `INSERT INTO groups (unit_id, code, name, capacity, whatsapp_link) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [unitId, code, name, capacity || null, whatsappLink || null]
  );
  res.status(201).json({ group: result.rows[0] });
}

async function update(req, res) {
  const { id } = req.params;
  const { name, capacity, isActive, whatsappLink } = req.body;

  const existing = await db.query(
    `SELECT g.id, g.unit_id, un.department_id
     FROM groups g JOIN units un ON un.id = g.unit_id
     WHERE g.id = $1`,
    [id]
  );
  if (!existing.rows.length) throw httpError(404, 'Group not found');

  const { unit_id: unitId, department_id: departmentId } = existing.rows[0];
  if (!scopeAllows(req.permissionScopes, { departmentId, unitId })) {
    throw httpError(403, 'You are not authorized to manage this group');
  }

  const result = await db.query(
    `UPDATE groups
     SET name      = COALESCE($1, name),
         capacity  = COALESCE($2, capacity),
         is_active = COALESCE($3, is_active),
         whatsapp_link = CASE WHEN $4::boolean THEN $5 ELSE whatsapp_link END
     WHERE id = $6
     RETURNING *`,
    [name || null, capacity ?? null, isActive ?? null,
     whatsappLink !== undefined, whatsappLink || null, id]
  );
  res.json({ group: result.rows[0] });
}

async function exportVcf(req, res) {
  const { id } = req.params;

  const existing = await db.query(
    `SELECT g.id, g.code, g.unit_id, un.department_id, un.short_code AS unit_short_code, un.code AS unit_code
     FROM groups g JOIN units un ON un.id = g.unit_id
     WHERE g.id = $1`,
    [id]
  );
  if (!existing.rows.length) throw httpError(404, 'Group not found');

  const group = existing.rows[0];
  const { unit_id: unitId, department_id: departmentId } = group;

  if (!scopeAllows(req.permissionScopes, { departmentId, unitId, groupId: id })) {
    throw httpError(403, 'You are not authorized to export contacts for this group');
  }

  const membersRes = await db.query(
    `SELECT u.full_name, u.phone_number, me.enrolled_at
     FROM member_enrollments me
     JOIN members m ON me.member_id = m.id
     JOIN users u ON m.user_id = u.id
     WHERE me.group_id = $1 AND me.status = 'active'
     ORDER BY me.enrolled_at ASC`,
    [id]
  );

  const prefix = (group.unit_short_code || group.unit_code || '').toLowerCase();
  const groupPart = group.code.toLowerCase().startsWith('g') ? group.code.toLowerCase() : `g${group.code.toLowerCase()}`;

  let vcfContent = '';
  let skippedCount = 0;
  membersRes.rows.forEach((m, idx) => {
    if (!m.phone_number || m.phone_number.trim() === '') {
      skippedCount++;
      return;
    }
    const indexStr = String(idx + 1).padStart(2, '0');
    const contactName = `${prefix}_${groupPart}_${indexStr} - ${m.full_name}`;
    vcfContent += 'BEGIN:VCARD\r\n';
    vcfContent += 'VERSION:3.0\r\n';
    vcfContent += `FN:${contactName}\r\n`;
    vcfContent += `N:;${contactName};;;\r\n`;
    vcfContent += `TEL;TYPE=CELL:${m.phone_number.trim()}\r\n`;
    vcfContent += 'END:VCARD\r\n';
  });

  res.setHeader('Content-Type', 'text/vcard');
  res.setHeader('Content-Disposition', `attachment; filename="${prefix}_${groupPart}_contacts.vcf"`);
  res.setHeader('X-Skipped-Contacts-Count', String(skippedCount));
  res.send(vcfContent);
}

module.exports = { list, create, update, exportVcf };
