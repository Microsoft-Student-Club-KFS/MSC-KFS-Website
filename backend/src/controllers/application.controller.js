/**
 * Microsoft Campus Club - KFS
 * Application Controller
 * File: backend/src/controllers/application.controller.js
 */

const db = require('../config/db');
const httpError = require('../utils/httpError');
const { hashPassword } = require('../utils/password');
const { chooseGroupForAssignment } = require('../utils/autoAssignment');
const { sendAcceptanceEmail, sendRejectionEmail } = require('../utils/email');

// GET /api/applications/status
async function getStatus(req, res) {
  const result = await db.query('SELECT kind, is_open FROM application_windows');
  const status = {
    board: { isOpen: false },
    member: { isOpen: false }
  };
  result.rows.forEach(row => {
    status[row.kind] = { isOpen: row.is_open };
  });
  res.json(status);
}

// GET /api/applications/tracks
async function getTracks(req, res) {
  const result = await db.query(`
    SELECT u.id, u.name, d.name AS "departmentName"
    FROM units u
    JOIN departments d ON u.department_id = d.id
    WHERE u.kind = 'track' AND u.is_active = true
    ORDER BY u.name
  `);
  res.json({ tracks: result.rows });
}

// GET /api/applications/departments (Public)
async function getDepartments(req, res) {
  const result = await db.query(`
    SELECT id, name, code
    FROM departments
    WHERE is_active = true
    ORDER BY name
  `);
  res.json({ departments: result.rows });
}

// POST /api/applications (Public)
async function submit(req, res) {
  const {
    kind, fullName, email, phoneNumber,
    memberStatus, universityName, universityYear,
    companyName, jobTitle, linkedinUrl, githubUrl,
    desiredUnitId, desiredDepartmentId, desiredRole,
    referralSource, whyJoin, skills
  } = req.body;

  if (!kind || !fullName || !email || !phoneNumber || !referralSource || !whyJoin || !skills || !linkedinUrl) {
    throw httpError(400, 'kind, fullName, email, phoneNumber, referralSource, whyJoin, skills and linkedinUrl are required');
  }

  if (!['board', 'member'].includes(kind)) {
    throw httpError(400, "kind must be 'board' or 'member'");
  }

  const validReferrals = ['Friend', 'LinkedIn', 'X', 'Facebook', 'Other'];
  if (!validReferrals.includes(referralSource)) {
    throw httpError(400, `referralSource must be one of: ${validReferrals.join(', ')}`);
  }

  // 1. Verify application window is open
  const windowCheck = await db.query(
    'SELECT is_open FROM application_windows WHERE kind = $1',
    [kind]
  );
  if (windowCheck.rowCount === 0 || !windowCheck.rows[0].is_open) {
    throw httpError(403, `${kind === 'board' ? 'Board' : 'Member'} applications are currently closed`);
  }

  // 2. Validate fullName (English letters and spaces/punctuation only)
  if (!/^[A-Za-z'\-.\s]+$/.test(fullName)) {
    throw httpError(400, 'Full name must be written in English letters only');
  }

  // 3. Conditional fields validation
  if (memberStatus && !['student', 'graduate'].includes(memberStatus)) {
    throw httpError(400, "memberStatus must be 'student' or 'graduate'");
  }
  if (memberStatus === 'student' && !universityName) {
    throw httpError(400, 'universityName is required for a student');
  }
  if (memberStatus === 'graduate' && !companyName) {
    throw httpError(400, 'companyName is required for a graduate');
  }

  // 4. Validate kind-specific fields
  if (kind === 'member') {
    if (!desiredUnitId) {
      throw httpError(400, 'desiredUnitId is required for member applications');
    }
    if (desiredDepartmentId || desiredRole) {
      throw httpError(400, 'desiredDepartmentId and desiredRole are not allowed for member applications');
    }
    const unitCheck = await db.query(
      "SELECT id FROM units WHERE id = $1 AND kind = 'track' AND is_active = true",
      [desiredUnitId]
    );
    if (unitCheck.rowCount === 0) {
      throw httpError(400, 'desiredUnitId must reference an active track unit');
    }
  } else {
    // board kind
    if (desiredUnitId) {
      throw httpError(400, 'desiredUnitId is not allowed for board applications');
    }
    if (!desiredDepartmentId || !desiredRole) {
      throw httpError(400, 'desiredDepartmentId and desiredRole are required for board applications');
    }
    const deptCheck = await db.query(
      "SELECT id FROM departments WHERE id = $1 AND is_active = true",
      [desiredDepartmentId]
    );
    if (deptCheck.rowCount === 0) {
      throw httpError(400, 'desiredDepartmentId must reference an active department');
    }
  }

  // 5. Insert application
  const result = await db.query(
    `INSERT INTO applications (
       kind, full_name, email, phone_number, member_status,
       university_name, university_year, company_name, job_title,
       linkedin_url, github_url, desired_unit_id, desired_department_id, desired_role,
       referral_source, why_join, skills, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'pending')
     RETURNING id`,
    [
      kind, fullName, email, phoneNumber, memberStatus || null,
      universityName || null, universityYear || null, companyName || null,
      jobTitle || null, linkedinUrl || null, githubUrl || null,
      desiredUnitId || null, desiredDepartmentId || null, desiredRole || null,
      referralSource, whyJoin, skills
    ]
  );

  res.status(201).json({
    id: result.rows[0].id,
    _warning: "Rate limiting is recommended for this public endpoint in production environments."
  });
}

// GET /api/applications (Authenticated, application.manage)
async function list(req, res) {
  const { kind, status } = req.query;

  let query = `
    SELECT a.*,
           u.name AS "desiredUnitName", u.code AS "desiredUnitCode",
           d.name AS "desiredDepartmentName", d.code AS "desiredDepartmentCode"
    FROM applications a
    LEFT JOIN units u ON a.desired_unit_id = u.id
    LEFT JOIN departments d ON a.desired_department_id = d.id
    WHERE 1=1
  `;
  const params = [];

  if (kind) {
    params.push(kind);
    query += ` AND a.kind = $${params.length}`;
  }

  if (status) {
    params.push(status);
    query += ` AND a.status = $${params.length}`;
  }

  query += ` ORDER BY a.submitted_at DESC`;

  const result = await db.query(query, params);
  res.json({ applications: result.rows });
}

// PATCH /api/application-windows/:kind (Authenticated, application.manage)
async function toggleWindow(req, res) {
  const { kind } = req.params;
  const { isOpen } = req.body;

  if (!['board', 'member'].includes(kind)) {
    throw httpError(400, "kind must be 'board' or 'member'");
  }

  if (typeof isOpen !== 'boolean') {
    throw httpError(400, 'isOpen must be a boolean');
  }

  const result = await db.query(
    `UPDATE application_windows
     SET is_open = $1, updated_by = $2, updated_at = now()
     WHERE kind = $3
     RETURNING kind, is_open`,
    [isOpen, req.user.id, kind]
  );

  res.json({ window: result.rows[0] });
}

// PATCH /api/applications/:id/decision (Authenticated, application.manage)
async function decide(req, res) {
  const { id } = req.params;
  const { decision, notes } = req.body;

  if (!['accepted', 'rejected'].includes(decision)) {
    throw httpError(400, "decision must be 'accepted' or 'rejected'");
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch application with pessimistic locking to prevent race conditions
    const appRes = await client.query(
      `SELECT * FROM applications WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (appRes.rowCount === 0) {
      throw httpError(404, 'Application not found');
    }

    const application = appRes.rows[0];
    if (application.status !== 'pending') {
      throw httpError(409, 'This application has already been decided');
    }

    // 2. Handle Rejection
    if (decision === 'rejected') {
      await client.query(
        `UPDATE applications
         SET status = 'rejected', reviewed_by = $1, reviewed_at = now(), review_notes = $2
         WHERE id = $3`,
        [req.user.id, notes || null, id]
      );
      await client.query('COMMIT');

      // Send rejection email in background
      sendRejectionEmail(application).catch(err => {
        console.error('[EMAIL] Failed to send rejection email:', err);
      });

      return res.json({ status: 'rejected' });
    }

    // 3. Handle Acceptance
    // Validate that the email does not already belong to a user
    const emailCheck = await client.query('SELECT 1 FROM users WHERE email = $1', [application.email]);
    if (emailCheck.rowCount > 0) {
      throw httpError(400, `A user with the email '${application.email}' already exists in the system.`);
    }

    // A. Generate unique username
    const emailLocal = application.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    let baseUsername = emailLocal || 'user';
    let username = baseUsername;
    let suffix = 1;
    let uniqueFound = false;
    while (!uniqueFound) {
      const check = await client.query('SELECT 1 FROM users WHERE username = $1', [username]);
      if (check.rowCount === 0) {
        uniqueFound = true;
      } else {
        username = `${baseUsername}${suffix}`;
        suffix++;
      }
    }

    // B. Generate temporary password
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
    let tempPassword = '';
    for (let i = 0; i < 10; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const passwordHash = await hashPassword(tempPassword);

    // C. Insert user account
    const userInsert = await client.query(
      `INSERT INTO users (
         username, password_hash, full_name, email, phone_number, member_status,
         university_name, university_year, company_name, job_title,
         linkedin_url, github_url, account_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
       RETURNING id`,
      [
        username,
        passwordHash,
        application.full_name,
        application.email,
        application.phone_number,
        application.member_status || null,
        application.university_name || null,
        application.university_year || null,
        application.company_name || null,
        application.job_title || null,
        application.linkedin_url || null,
        application.github_url || null
      ]
    );
    const createdUserId = userInsert.rows[0].id;

    let assignedGroupId = null;
    let groupCode = null;

    if (application.kind === 'member') {
      // D. Run auto-assignment to find group
      const groupsRes = await client.query(
        `SELECT g.id, g.code, g.capacity,
                (SELECT COUNT(*)::int FROM member_enrollments me WHERE me.group_id = g.id AND me.status = 'active') AS "activeCount"
         FROM groups g
         WHERE g.unit_id = $1 AND g.is_active = true`,
        [application.desired_unit_id]
      );
      
      const groupsList = groupsRes.rows.map(r => ({
        id: r.id,
        code: r.code,
        capacity: r.capacity,
        activeCount: r.activeCount
      }));

      assignedGroupId = chooseGroupForAssignment(groupsList);
      if (!assignedGroupId) {
        throw httpError(409, 'No group in this track has room — add another group first');
      }

      const chosenGroup = groupsRes.rows.find(g => g.id === assignedGroupId);
      groupCode = chosenGroup ? chosenGroup.code : null;

      // E. Create members record
      const memberInsert = await client.query(
        `INSERT INTO members (user_id) VALUES ($1) RETURNING id`,
        [createdUserId]
      );
      const memberId = memberInsert.rows[0].id;

      // F. Create enrollment record
      await client.query(
        `INSERT INTO member_enrollments (member_id, group_id, status) VALUES ($1, $2, 'active')`,
        [memberId, assignedGroupId]
      );

      // G. Fetch role ID for member and assign scoped group role
      const roleRes = await client.query(`SELECT id FROM roles WHERE code = 'member'`);
      if (roleRes.rowCount === 0) {
        throw httpError(500, 'Member role not found in database');
      }
      const memberRoleId = roleRes.rows[0].id;

      await client.query(
        `INSERT INTO user_roles (user_id, role_id, scope_type, scope_id) VALUES ($1, $2, 'group', $3)`,
        [createdUserId, memberRoleId, assignedGroupId]
      );
    }

    // H. Update application record status
    await client.query(
      `UPDATE applications
       SET status = 'accepted', reviewed_by = $1, reviewed_at = now(), review_notes = $2,
           assigned_group_id = $3, created_user_id = $4
       WHERE id = $5`,
      [req.user.id, notes || null, assignedGroupId, createdUserId, id]
    );

    await client.query('COMMIT');

    // Send acceptance email in background
    db.query(`
      SELECT a.*,
             u.name AS "desiredUnitName",
             d.name AS "desiredDepartmentName"
      FROM applications a
      LEFT JOIN units u ON a.desired_unit_id = u.id
      LEFT JOIN departments d ON a.desired_department_id = d.id
      WHERE a.id = $1
    `, [id])
    .then(finalAppRes => {
      if (finalAppRes.rowCount > 0) {
        sendAcceptanceEmail(finalAppRes.rows[0], {
          username,
          temporaryPassword: tempPassword,
          groupCode,
          assignedGroupId
        });
      }
    })
    .catch(err => console.error('[EMAIL] Failed to fetch application details for email:', err));

    res.json({
      status: 'accepted',
      username,
      temporaryPassword: tempPassword,
      assignedGroupId,
      groupCode
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getStatus,
  getTracks,
  getDepartments,
  submit,
  list,
  toggleWindow,
  decide
};
