const db = require('../config/db');
const httpError = require('../utils/httpError');
const { hashPassword } = require('../utils/password');

const USER_LIST_FIELDS = `
  id, username, full_name, email, phone_number, account_status, member_status,
  university_name, university_year, company_name, job_title,
  linkedin_url, github_url, created_at
`;

async function list(req, res) {
  const result = await db.query(
    `SELECT DISTINCT u.id, u.username, u.full_name, u.email, u.phone_number, u.account_status, u.member_status,
           u.university_name, u.university_year, u.company_name, u.job_title,
           u.linkedin_url, u.github_url, u.created_at
     FROM users u
     JOIN user_roles ur_scope ON ur_scope.user_id = $1
     WHERE ur_scope.scope_type = 'global'
        OR (ur_scope.scope_type = 'department' AND (
          EXISTS (
            SELECT 1 FROM member_enrollments me
            JOIN members m ON me.member_id = m.id
            JOIN groups g ON me.group_id = g.id
            JOIN units un ON g.unit_id = un.id
            WHERE m.user_id = u.id AND un.department_id = ur_scope.scope_id
          )
          OR EXISTS (
            SELECT 1 FROM user_roles ur2
            WHERE ur2.user_id = u.id AND (
              (ur2.scope_type = 'department' AND ur2.scope_id = ur_scope.scope_id)
              OR (ur2.scope_type = 'unit' AND ur2.scope_id IN (SELECT id FROM units WHERE department_id = ur_scope.scope_id))
              OR (ur2.scope_type = 'group' AND ur2.scope_id IN (SELECT g.id FROM groups g JOIN units un ON g.unit_id = un.id WHERE un.department_id = ur_scope.scope_id))
            )
          )
        ))
        OR (ur_scope.scope_type = 'unit' AND (
          EXISTS (
            SELECT 1 FROM member_enrollments me
            JOIN members m ON me.member_id = m.id
            JOIN groups g ON me.group_id = g.id
            WHERE m.user_id = u.id AND g.unit_id = ur_scope.scope_id
          )
          OR EXISTS (
            SELECT 1 FROM user_roles ur2
            WHERE ur2.user_id = u.id AND (
              (ur2.scope_type = 'unit' AND ur2.scope_id = ur_scope.scope_id)
              OR (ur2.scope_type = 'group' AND ur2.scope_id IN (SELECT id FROM groups WHERE unit_id = ur_scope.scope_id))
            )
          )
        ))
        OR (ur_scope.scope_type = 'group' AND (
          EXISTS (
            SELECT 1 FROM member_enrollments me
            JOIN members m ON me.member_id = m.id
            WHERE m.user_id = u.id AND me.group_id = ur_scope.scope_id
          )
          OR EXISTS (
            SELECT 1 FROM user_roles ur2
            WHERE ur2.user_id = u.id AND ur2.scope_type = 'group' AND ur2.scope_id = ur_scope.scope_id
          )
        ))
        OR u.id = $1
     ORDER BY u.full_name`,
    [req.user.id]
  );
  res.json({ users: result.rows });
}

async function search(req, res) {
  const q = (req.query.q || '').trim();
  const pattern = `%${q}%`;

  const result = await db.query(
    `SELECT id, full_name, email, username, phone_number
     FROM users
     WHERE account_status = 'active'
       AND ($1 = '' OR full_name ILIKE $2 OR email ILIKE $2 OR username ILIKE $2)
     ORDER BY full_name
     LIMIT 20`,
    [q, pattern]
  );
  res.json({ users: result.rows });
}

async function create(req, res) {
  const {
    username, password, fullName, email, phoneNumber,
    memberStatus, universityName, universityYear,
    companyName, jobTitle, linkedinUrl, githubUrl,
  } = req.body;

  if (!username || !password || !fullName || !email || !linkedinUrl) {
    throw httpError(400, 'username, password, fullName, email and linkedinUrl are required');
  }
  if (password.length < 8) {
    throw httpError(400, 'Password must be at least 8 characters');
  }
  if (!/^[A-Za-z'\-.\s]+$/.test(fullName)) {
    throw httpError(400, 'Full name must be written in English letters only');
  }
  if (memberStatus && !['student', 'graduate'].includes(memberStatus)) {
    throw httpError(400, "memberStatus must be 'student' or 'graduate'");
  }
  if (memberStatus === 'student' && !universityName) {
    throw httpError(400, 'universityName is required for a student');
  }
  if (memberStatus === 'graduate' && !companyName) {
    throw httpError(400, 'companyName is required for a graduate');
  }

  const passwordHash = await hashPassword(password);

  try {
    const result = await db.query(
      `INSERT INTO users (
         username, password_hash, full_name, email, phone_number, member_status,
         university_name, university_year, company_name, job_title,
         linkedin_url, github_url
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING ${USER_LIST_FIELDS}`,
      [
        username, passwordHash, fullName, email, phoneNumber || null, memberStatus || null,
        universityName || null, universityYear || null, companyName || null,
        jobTitle || null, linkedinUrl || null, githubUrl || null,
      ]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      const field = err.constraint && err.constraint.includes('email') ? 'email' : 'username';
      throw httpError(409, `That ${field} is already in use`);
    }
    throw err;
  }
}

async function update(req, res) {
  const { id } = req.params;
  const {
    fullName, email, phoneNumber, memberStatus,
    universityName, universityYear, companyName, jobTitle,
    linkedinUrl, githubUrl, accountStatus
  } = req.body;

  const callerId = req.user.id;
  const targetUserId = id;

  const scopeCheck = await db.query(
    `SELECT 1 FROM user_roles ur_scope
     WHERE ur_scope.user_id = $1 AND (
       ur_scope.scope_type = 'global'
       OR (
         -- Scope check
         (
           (ur_scope.scope_type = 'department' AND (
             EXISTS (
               SELECT 1 FROM member_enrollments me
               JOIN members m ON me.member_id = m.id
               JOIN groups g ON me.group_id = g.id
               JOIN units un ON g.unit_id = un.id
               WHERE m.user_id = $2 AND un.department_id = ur_scope.scope_id
             )
             OR EXISTS (
               SELECT 1 FROM user_roles ur2
               WHERE ur2.user_id = $2 AND (
                 (ur2.scope_type = 'department' AND ur2.scope_id = ur_scope.scope_id)
                 OR (ur2.scope_type = 'unit' AND ur2.scope_id IN (SELECT id FROM units WHERE department_id = ur_scope.scope_id))
                 OR (ur2.scope_type = 'group' AND ur2.scope_id IN (SELECT g.id FROM groups g JOIN units un ON g.unit_id = un.id WHERE un.department_id = ur_scope.scope_id))
               )
             )
           ))
           OR (ur_scope.scope_type = 'unit' AND (
             EXISTS (
               SELECT 1 FROM member_enrollments me
               JOIN members m ON me.member_id = m.id
               JOIN groups g ON me.group_id = g.id
               WHERE m.user_id = $2 AND g.unit_id = ur_scope.scope_id
             )
             OR EXISTS (
               SELECT 1 FROM user_roles ur2
               WHERE ur2.user_id = $2 AND (
                 (ur2.scope_type = 'unit' AND ur2.scope_id = ur_scope.scope_id)
                 OR (ur2.scope_type = 'group' AND ur2.scope_id IN (SELECT id FROM groups WHERE unit_id = ur_scope.scope_id))
               )
             )
           ))
           OR (ur_scope.scope_type = 'group' AND (
             EXISTS (
               SELECT 1 FROM member_enrollments me
               JOIN members m ON me.member_id = m.id
               WHERE m.user_id = $2 AND me.group_id = ur_scope.scope_id
             )
             OR EXISTS (
               SELECT 1 FROM user_roles ur2
               WHERE ur2.user_id = $2 AND ur2.scope_type = 'group' AND ur2.scope_id = ur_scope.scope_id
             )
           ))
         )
         -- Hierarchy check
         AND (
           (
             SELECT COALESCE(MAX(
               CASE r.code
                 WHEN 'full_access' THEN 70
                 WHEN 'department_director' THEN 60
                 WHEN 'unit_lead' THEN 50
                 WHEN 'unit_vice_lead' THEN 40
                 WHEN 'team_member' THEN 30
                 WHEN 'mentor' THEN 20
                 WHEN 'member' THEN 10
                 ELSE 0
               END
             ), 0)
             FROM user_roles ur
             JOIN roles r ON ur.role_id = r.id
             WHERE ur.user_id = $1
           ) > (
             SELECT COALESCE(MAX(
               CASE r.code
                 WHEN 'full_access' THEN 70
                 WHEN 'department_director' THEN 60
                 WHEN 'unit_lead' THEN 50
                 WHEN 'unit_vice_lead' THEN 40
                 WHEN 'team_member' THEN 30
                 WHEN 'mentor' THEN 20
                 WHEN 'member' THEN 10
                 ELSE 0
               END
             ), 0)
             FROM user_roles ur
             JOIN roles r ON ur.role_id = r.id
             WHERE ur.user_id = $2
           )
         )
       )
     )`,
    [callerId, targetUserId]
  );

  if (!scopeCheck.rows.length && callerId !== targetUserId) {
    throw httpError(403, 'You are not authorized to manage this user');
  }

  const existing = await db.query('SELECT id, member_status, university_name, company_name FROM users WHERE id = $1', [id]);
  if (!existing.rows.length) throw httpError(404, 'User not found');

  const currStatus = memberStatus !== undefined ? memberStatus : existing.rows[0].member_status;
  const currUni = universityName !== undefined ? universityName : existing.rows[0].university_name;
  const currCompany = companyName !== undefined ? companyName : existing.rows[0].company_name;

  if (fullName && !/^[A-Za-z'\-.\s]+$/.test(fullName)) {
    throw httpError(400, 'Full name must be written in English letters only');
  }
  if (currStatus && !['student', 'graduate'].includes(currStatus)) {
    throw httpError(400, "memberStatus must be 'student' or 'graduate'");
  }
  if (currStatus === 'student' && !currUni) {
    throw httpError(400, 'universityName is required for a student');
  }
  if (currStatus === 'graduate' && !currCompany) {
    throw httpError(400, 'companyName is required for a graduate');
  }
  if (linkedinUrl !== undefined && !linkedinUrl) {
    throw httpError(400, 'LinkedIn URL is required and cannot be empty');
  }

  try {
    const result = await db.query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           email = COALESCE($2, email),
           phone_number = COALESCE($3, phone_number),
           member_status = COALESCE($4, member_status),
           university_name = COALESCE($5, university_name),
           university_year = COALESCE($6, university_year),
           company_name = COALESCE($7, company_name),
           job_title = COALESCE($8, job_title),
           linkedin_url = COALESCE($9, linkedin_url),
           github_url = COALESCE($10, github_url),
           account_status = COALESCE($11, account_status),
           updated_at = now()
       WHERE id = $12
       RETURNING ${USER_LIST_FIELDS}`,
      [
        fullName || null, email || null, phoneNumber || null, memberStatus || null,
        universityName || null, universityYear || null, companyName || null, jobTitle || null,
        linkedinUrl || null, githubUrl || null, accountStatus || null, id
      ]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      const field = err.constraint && err.constraint.includes('email') ? 'email' : 'username';
      throw httpError(409, `That ${field} is already in use`);
    }
    throw err;
  }
}

async function remove(req, res) {
  const { id } = req.params;

  const callerId = req.user.id;
  const targetUserId = id;

  const scopeCheck = await db.query(
    `SELECT 1 FROM user_roles ur_scope
     WHERE ur_scope.user_id = $1 AND (
       ur_scope.scope_type = 'global'
       OR (
         -- Scope check
         (
           (ur_scope.scope_type = 'department' AND (
             EXISTS (
               SELECT 1 FROM member_enrollments me
               JOIN members m ON me.member_id = m.id
               JOIN groups g ON me.group_id = g.id
               JOIN units un ON g.unit_id = un.id
               WHERE m.user_id = $2 AND un.department_id = ur_scope.scope_id
             )
             OR EXISTS (
               SELECT 1 FROM user_roles ur2
               WHERE ur2.user_id = $2 AND (
                 (ur2.scope_type = 'department' AND ur2.scope_id = ur_scope.scope_id)
                 OR (ur2.scope_type = 'unit' AND ur2.scope_id IN (SELECT id FROM units WHERE department_id = ur_scope.scope_id))
                 OR (ur2.scope_type = 'group' AND ur2.scope_id IN (SELECT g.id FROM groups g JOIN units un ON g.unit_id = u.id WHERE un.department_id = ur_scope.scope_id))
               )
             )
           ))
           OR (ur_scope.scope_type = 'unit' AND (
             EXISTS (
               SELECT 1 FROM member_enrollments me
               JOIN members m ON me.member_id = m.id
               JOIN groups g ON me.group_id = g.id
               WHERE m.user_id = $2 AND g.unit_id = ur_scope.scope_id
             )
             OR EXISTS (
               SELECT 1 FROM user_roles ur2
               WHERE ur2.user_id = $2 AND (
                 (ur2.scope_type = 'unit' AND ur2.scope_id = ur_scope.scope_id)
                 OR (ur2.scope_type = 'group' AND ur2.scope_id IN (SELECT id FROM groups WHERE unit_id = ur_scope.scope_id))
               )
             )
           ))
           OR (ur_scope.scope_type = 'group' AND (
             EXISTS (
               SELECT 1 FROM member_enrollments me
               JOIN members m ON me.member_id = m.id
               WHERE m.user_id = $2 AND me.group_id = ur_scope.scope_id
             )
             OR EXISTS (
               SELECT 1 FROM user_roles ur2
               WHERE ur2.user_id = $2 AND ur2.scope_type = 'group' AND ur2.scope_id = ur_scope.scope_id
             )
           ))
         )
         -- Hierarchy check
         AND (
           (
             SELECT COALESCE(MAX(
               CASE r.code
                 WHEN 'full_access' THEN 70
                 WHEN 'department_director' THEN 60
                 WHEN 'unit_lead' THEN 50
                 WHEN 'unit_vice_lead' THEN 40
                 WHEN 'team_member' THEN 30
                 WHEN 'mentor' THEN 20
                 WHEN 'member' THEN 10
                 ELSE 0
               END
             ), 0)
             FROM user_roles ur
             JOIN roles r ON ur.role_id = r.id
             WHERE ur.user_id = $1
           ) > (
             SELECT COALESCE(MAX(
               CASE r.code
                 WHEN 'full_access' THEN 70
                 WHEN 'department_director' THEN 60
                 WHEN 'unit_lead' THEN 50
                 WHEN 'unit_vice_lead' THEN 40
                 WHEN 'team_member' THEN 30
                 WHEN 'mentor' THEN 20
                 WHEN 'member' THEN 10
                 ELSE 0
               END
             ), 0)
             FROM user_roles ur
             JOIN roles r ON ur.role_id = r.id
             WHERE ur.user_id = $2
           )
         )
       )
     )`,
    [callerId, targetUserId]
  );

  if (!scopeCheck.rows.length && callerId !== targetUserId) {
    throw httpError(403, 'You are not authorized to manage this user');
  }

  const existing = await db.query('SELECT id FROM users WHERE id = $1', [id]);
  if (!existing.rows.length) throw httpError(404, 'User not found');

  await db.query('DELETE FROM users WHERE id = $1', [id]);
  res.json({ message: 'User deleted successfully' });
}

async function getUserRoles(req, res) {
  const { id: userId } = req.params;

  const result = await db.query(
    `SELECT ur.id, ur.scope_type AS "scopeType", ur.scope_id AS "scopeId",
            r.code AS "roleCode", r.name AS "roleName", ur.assigned_at AS "assignedAt",
            CASE ur.scope_type
              WHEN 'department' THEN (SELECT name FROM departments WHERE id = ur.scope_id)
              WHEN 'unit' THEN (SELECT name FROM units WHERE id = ur.scope_id)
              WHEN 'group' THEN (SELECT name FROM groups WHERE id = ur.scope_id)
              ELSE 'Global'
            END AS "scopeName"
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY ur.assigned_at DESC`,
    [userId]
  );
  res.json({ roles: result.rows });
}

module.exports = { list, search, create, update, remove, getUserRoles };

