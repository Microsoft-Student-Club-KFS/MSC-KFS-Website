/**
 * Microsoft Campus Club - KFS
 * Portal Controller (Sessions, Attendance, Assignments, Submissions, Stats)
 * File: backend/src/controllers/portal.controller.js
 */

const db = require('../config/db');
const httpError = require('../utils/httpError');
const { scopeAllows, hasGlobalScope } = require('../utils/scope');
const { sendAcceptanceEmail } = require('../utils/email');

// Helper: Get target scopes for a group
async function getGroupTarget(groupId) {
  const res = await db.query(`
    SELECT g.id AS "groupId", g.unit_id AS "unitId", u.department_id AS "departmentId"
    FROM groups g
    JOIN units u ON g.unit_id = u.id
    WHERE g.id = $1
  `, [groupId]);
  return res.rows[0];
}

// 1. GET /api/dashboard/stats (Global Admin only)
async function getDashboardStats(req, res) {
  if (!hasGlobalScope(req.permissionScopes)) {
    throw httpError(403, 'Unauthorized. Admin stats only.');
  }

  // Board / Staff members: any active user who does NOT hold the 'member' role
  const boardMembersRes = await db.query(`
    SELECT COUNT(DISTINCT u.id)
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.account_status = 'active'
      AND (r.code IS NULL OR r.code != 'member')
  `);

  // TMP Student Members: any active user who holds the 'member' role
  const studentMembersRes = await db.query(`
    SELECT COUNT(DISTINCT ur.user_id)
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN users u ON u.id = ur.user_id
    WHERE u.account_status = 'active'
      AND r.code = 'member'
  `);

  const groupsRes = await db.query(`SELECT COUNT(*) FROM groups WHERE is_active = true`);

  // Applications breakdown
  const appsRes = await db.query(`
    SELECT status, COUNT(*) FROM applications GROUP BY status
  `);
  const appsStats = { pending: 0, accepted: 0, rejected: 0 };
  appsRes.rows.forEach(row => { appsStats[row.status] = parseInt(row.count, 10); });

  // Recent 5 applications
  const recentAppsRes = await db.query(`
    SELECT a.id, a.full_name AS "fullName", a.kind, a.status, a.submitted_at AS "submittedAt",
      a.desired_unit_id AS "desiredUnitId", a.desired_department_id AS "desiredDepartmentId",
      a.desired_role AS "desiredRole",
      u.name AS "desiredUnitName", d.name AS "desiredDepartmentName"
    FROM applications a
    LEFT JOIN units u ON a.desired_unit_id = u.id
    LEFT JOIN departments d ON a.desired_department_id = d.id
    ORDER BY a.submitted_at DESC LIMIT 5
  `);

  // Overall attendance rate
  const attendanceRes = await db.query(`
    SELECT COALESCE(ROUND(100.0 * COUNT(CASE WHEN status = 'present' THEN 1 END) / NULLIF(COUNT(*), 0), 2), 0) AS rate 
    FROM attendance
  `);

  // Overall absence rate
  const absentRes = await db.query(`
    SELECT COALESCE(ROUND(100.0 * COUNT(CASE WHEN status = 'absent' THEN 1 END) / NULLIF(COUNT(*), 0), 2), 0) AS rate 
    FROM attendance
  `);

  // Task submission rate
  const tasksRes = await db.query(`
    SELECT COALESCE(ROUND(100.0 * COUNT(*) / NULLIF(
      (SELECT COUNT(*) FROM assignments a2 JOIN member_enrollments me2 ON me2.group_id = a2.group_id), 0), 2), 0) AS rate 
    FROM assignment_submissions
  `);

  // Per-group attendance summary — correctly joined through members table
  const groupAttendanceRes = await db.query(`
    SELECT g.name AS "groupName", u.name AS "unitName",
      COUNT(a.id) AS "totalRecords",
      COUNT(CASE WHEN a.status = 'absent' THEN 1 END) AS "absentCount",
      COUNT(CASE WHEN a.status = 'present' THEN 1 END) AS "presentCount",
      COALESCE(ROUND(100.0 * COUNT(CASE WHEN a.status = 'absent' THEN 1 END) / NULLIF(COUNT(a.id), 0), 1), 0) AS "absentRate"
    FROM groups g
    JOIN units u ON g.unit_id = u.id
    LEFT JOIN member_enrollments me ON me.group_id = g.id
    LEFT JOIN members mb ON mb.id = me.member_id
    LEFT JOIN attendance a ON a.user_id = mb.user_id
    WHERE g.is_active = true
    GROUP BY g.id, g.name, u.name
    ORDER BY "absentRate" DESC
    LIMIT 10
  `);

  res.json({
    boardMembers: parseInt(boardMembersRes.rows[0].count, 10),
    studentMembers: parseInt(studentMembersRes.rows[0].count, 10),
    totalMembers: parseInt(boardMembersRes.rows[0].count, 10) + parseInt(studentMembersRes.rows[0].count, 10),
    totalGroups: parseInt(groupsRes.rows[0].count, 10),
    applications: appsStats,
    recentApplications: recentAppsRes.rows,
    attendanceRate: parseFloat(attendanceRes.rows[0].rate),
    absentRate: parseFloat(absentRes.rows[0].rate),
    taskSubmissionRate: parseFloat(tasksRes.rows[0].rate),
    groupAttendance: groupAttendanceRes.rows
  });
}

// 2. GET /api/groups/:id/sessions
async function getGroupSessions(req, res) {
  const { id: groupId } = req.params;
  const target = await getGroupTarget(groupId);

  if (!target) throw httpError(404, 'Group not found');

  if (!scopeAllows(req.permissionScopes, target)) {
    throw httpError(403, 'Unauthorized access to this group sessions');
  }

  const result = await db.query(
    'SELECT * FROM group_sessions WHERE group_id = $1 ORDER BY session_date DESC',
    [groupId]
  );
  res.json({ sessions: result.rows });
}

// 3. POST /api/groups/:id/sessions
async function createGroupSession(req, res) {
  const { id: groupId } = req.params;
  const { title, meetingUrl, sessionDate } = req.body;

  if (!title || !meetingUrl) {
    throw httpError(400, 'title and meetingUrl are required');
  }

  const target = await getGroupTarget(groupId);
  if (!target) throw httpError(404, 'Group not found');

  if (!req.permissions.has('attendance.record.scope') && !hasGlobalScope(req.permissionScopes)) {
    throw httpError(403, 'Unauthorized. Requires session record permission.');
  }

  if (!scopeAllows(req.permissionScopes, target)) {
    throw httpError(403, 'Unauthorized access to this group');
  }

  const result = await db.query(
    `INSERT INTO group_sessions (group_id, title, meeting_url, session_date, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [groupId, title, meetingUrl, sessionDate || new Date(), req.user.id]
  );

  res.status(201).json({ session: result.rows[0] });
}

// 4. GET /api/sessions/:id/attendance
async function getSessionAttendance(req, res) {
  const { id: sessionId } = req.params;

  const session = await db.query('SELECT group_id FROM group_sessions WHERE id = $1', [sessionId]);
  if (!session.rows.length) throw httpError(404, 'Session not found');
  const groupId = session.rows[0].group_id;

  const target = await getGroupTarget(groupId);
  if (!req.permissions.has('attendance.view.scope') && !hasGlobalScope(req.permissionScopes)) {
    throw httpError(403, 'Unauthorized to view attendance list.');
  }

  if (!scopeAllows(req.permissionScopes, target)) {
    throw httpError(403, 'Unauthorized access to this group.');
  }

  const result = await db.query(`
    SELECT u.id AS "userId", u.full_name AS "fullName", u.email,
           a.status, a.id AS "attendanceId"
    FROM member_enrollments me
    JOIN users u ON me.user_id = u.id
    LEFT JOIN attendance a ON a.session_id = $1 AND a.user_id = u.id
    WHERE me.group_id = $2
    ORDER BY u.full_name
  `, [sessionId, groupId]);

  res.json({ attendance: result.rows });
}

// 5. POST /api/sessions/:id/attendance
async function saveSessionAttendance(req, res) {
  const { id: sessionId } = req.params;
  const { attendance } = req.body; // Array: [{ userId, status }]

  if (!Array.isArray(attendance)) {
    throw httpError(400, 'attendance array is required');
  }

  const session = await db.query('SELECT group_id FROM group_sessions WHERE id = $1', [sessionId]);
  if (!session.rows.length) throw httpError(404, 'Session not found');
  const groupId = session.rows[0].group_id;

  const target = await getGroupTarget(groupId);
  if (!req.permissions.has('attendance.record.scope') && !hasGlobalScope(req.permissionScopes)) {
    throw httpError(403, 'Unauthorized to mark attendance.');
  }

  if (!scopeAllows(req.permissionScopes, target)) {
    throw httpError(403, 'Unauthorized access to this group.');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const att of attendance) {
      if (!['present', 'absent', 'excused'].includes(att.status)) {
        throw httpError(400, `Invalid attendance status "${att.status}" for user ${att.userId}`);
      }
      await client.query(`
        INSERT INTO attendance (session_id, user_id, status, marked_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (session_id, user_id)
        DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = now()
      `, [sessionId, att.userId, att.status, req.user.id]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Attendance recorded successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// 6. GET /api/groups/:id/assignments
async function getGroupAssignments(req, res) {
  const { id: groupId } = req.params;
  const target = await getGroupTarget(groupId);
  if (!target) throw httpError(404, 'Group not found');

  if (!scopeAllows(req.permissionScopes, target)) {
    throw httpError(403, 'Unauthorized access to this group tasks');
  }

  const result = await db.query(`
    SELECT a.*,
           (SELECT json_build_object(
              'id', s.id, 'grade', s.grade, 'feedback', s.feedback,
              'submittedAt', s.submitted_at, 'submissionText', s.submission_text,
              'submissionUrl', s.submission_url
            )
            FROM assignment_submissions s 
            WHERE s.assignment_id = a.id AND s.user_id = $2) AS "mySubmission"
    FROM assignments a
    WHERE a.group_id = $1
    ORDER BY a.created_at DESC
  `, [groupId, req.user.id]);

  res.json({ assignments: result.rows });
}

// 7. POST /api/groups/:id/assignments
async function createAssignment(req, res) {
  const { id: groupId } = req.params;
  const { title, description, dueDate } = req.body;

  if (!title || !description) {
    throw httpError(400, 'title and description are required');
  }

  const target = await getGroupTarget(groupId);
  if (!target) throw httpError(404, 'Group not found');

  if (!req.permissions.has('evaluation.create.scope') && !hasGlobalScope(req.permissionScopes)) {
    throw httpError(403, 'Unauthorized. Requires evaluation creation permission.');
  }

  if (!scopeAllows(req.permissionScopes, target)) {
    throw httpError(403, 'Unauthorized access to this group.');
  }

  const result = await db.query(
    `INSERT INTO assignments (group_id, title, description, due_date, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [groupId, title, description, dueDate || null, req.user.id]
  );

  res.status(201).json({ assignment: result.rows[0] });
}

// 8. GET /api/assignments/:id/submissions
async function getAssignmentSubmissions(req, res) {
  const { id: assignmentId } = req.params;

  const assign = await db.query('SELECT group_id FROM assignments WHERE id = $1', [assignmentId]);
  if (!assign.rows.length) throw httpError(404, 'Assignment not found');
  const groupId = assign.rows[0].group_id;

  const target = await getGroupTarget(groupId);
  if (!req.permissions.has('evaluation.view.scope') && !hasGlobalScope(req.permissionScopes)) {
    throw httpError(403, 'Unauthorized to view submissions.');
  }

  if (!scopeAllows(req.permissionScopes, target)) {
    throw httpError(403, 'Unauthorized access to this group.');
  }

  const result = await db.query(`
    SELECT u.id AS "userId", u.full_name AS "fullName", u.email,
           s.id AS "submissionId", s.submission_text AS "submissionText",
           s.submission_url AS "submissionUrl", s.submitted_at AS "submittedAt",
           s.grade, s.feedback
    FROM member_enrollments me
    JOIN users u ON me.user_id = u.id
    JOIN assignments a ON a.group_id = me.group_id
    LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.user_id = u.id
    WHERE a.id = $1
    ORDER BY u.full_name
  `, [assignmentId]);

  res.json({ submissions: result.rows });
}

// 9. POST /api/assignments/:id/submissions
async function submitAssignment(req, res) {
  const { id: assignmentId } = req.params;
  const { submissionText, submissionUrl } = req.body;

  const assign = await db.query('SELECT group_id FROM assignments WHERE id = $1', [assignmentId]);
  if (!assign.rows.length) throw httpError(404, 'Assignment not found');
  const groupId = assign.rows[0].group_id;

  const enroll = await db.query('SELECT 1 FROM member_enrollments WHERE group_id = $1 AND user_id = $2', [groupId, req.user.id]);
  if (!enroll.rows.length) throw httpError(403, 'You are not enrolled in this group');

  const result = await db.query(`
    INSERT INTO assignment_submissions (assignment_id, user_id, submission_text, submission_url, submitted_at)
    VALUES ($1, $2, $3, $4, now())
    ON CONFLICT (assignment_id, user_id)
    DO UPDATE SET submission_text = EXCLUDED.submission_text, submission_url = EXCLUDED.submission_url, submitted_at = now()
    RETURNING *
  `, [assignmentId, req.user.id, submissionText || null, submissionUrl || null]);

  res.json({ submission: result.rows[0] });
}

// 10. PATCH /api/submissions/:id/grade
async function gradeSubmission(req, res) {
  const { id: submissionId } = req.params;
  const { grade, feedback } = req.body;

  if (grade === undefined) {
    throw httpError(400, 'grade is required');
  }

  const sub = await db.query(`
    SELECT s.id, a.group_id
    FROM assignment_submissions s
    JOIN assignments a ON s.assignment_id = a.id
    WHERE s.id = $1
  `, [submissionId]);
  if (!sub.rows.length) throw httpError(404, 'Submission not found');
  const groupId = sub.rows[0].group_id;

  const target = await getGroupTarget(groupId);
  if (!req.permissions.has('evaluation.create.scope') && !hasGlobalScope(req.permissionScopes)) {
    throw httpError(403, 'Unauthorized to grade submissions.');
  }

  if (!scopeAllows(req.permissionScopes, target)) {
    throw httpError(403, 'Unauthorized access to this group.');
  }

  const result = await db.query(`
    UPDATE assignment_submissions
    SET grade = $1, feedback = $2, graded_by = $3, graded_at = now()
    WHERE id = $4
    RETURNING *
  `, [grade, feedback || null, req.user.id, submissionId]);

  res.json({ submission: result.rows[0] });
}

// 11. GET /api/my-metrics (Student Portal)
async function getMyMetrics(req, res) {
  // Fetch Attendance — joined through members table
  const attendance = await db.query(`
    SELECT gs.title AS "sessionTitle", gs.session_date AS "sessionDate",
           att.status, att.marked_at AS "markedAt"
    FROM members mb
    JOIN member_enrollments me ON me.member_id = mb.id
    JOIN group_sessions gs ON gs.group_id = me.group_id
    LEFT JOIN attendance att ON att.session_id = gs.id AND att.user_id = mb.user_id
    WHERE mb.user_id = $1
    ORDER BY gs.session_date DESC
  `, [req.user.id]);

  // Fetch Submissions — joined through members table
  const submissions = await db.query(`
    SELECT a.title AS "assignmentTitle", a.due_date AS "dueDate",
           s.submission_text AS "submissionText", s.submission_url AS "submissionUrl",
           s.grade, s.feedback, s.submitted_at AS "submittedAt"
    FROM members mb
    JOIN member_enrollments me ON me.member_id = mb.id
    JOIN assignments a ON a.group_id = me.group_id
    LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.user_id = mb.user_id
    WHERE mb.user_id = $1
    ORDER BY a.created_at DESC
  `, [req.user.id]);

  // Fetch Group and Mentors info — joined through members table
  const groupInfo = await db.query(`
    SELECT g.name AS "groupName", u.name AS "trackName",
           (SELECT COALESCE(json_agg(json_build_object('fullName', mentor.full_name, 'email', mentor.email)), '[]')
            FROM user_roles ur
            JOIN users mentor ON mentor.id = ur.user_id
            WHERE ur.scope_type = 'group' AND ur.scope_id = g.id) AS mentors
    FROM members mb
    JOIN member_enrollments me ON me.member_id = mb.id
    JOIN groups g ON me.group_id = g.id
    JOIN units u ON g.unit_id = u.id
    WHERE mb.user_id = $1
  `, [req.user.id]);

  res.json({
    attendance: attendance.rows,
    submissions: submissions.rows,
    group: groupInfo.rows[0] || null
  });
}

// 12. GET /api/portal/settings/smtp (Global Admin)
async function getSMTPSettings(req, res) {
  if (!hasGlobalScope(req.permissionScopes)) {
    throw httpError(403, 'Unauthorized. Admin settings only.');
  }

  const result = await db.query("SELECT value FROM system_settings WHERE key = 'smtp'");
  if (result.rowCount === 0) {
    return res.json({
      host: '',
      port: 587,
      secure: false,
      user: '',
      hasPassword: false,
      fromEmail: '',
      fromName: '',
      whatsappGroupLink: '',
      platformUrl: ''
    });
  }

  const val = result.rows[0].value;
  res.json({
    host: val.host || '',
    port: parseInt(val.port, 10) || 587,
    secure: val.secure === true,
    user: val.user || '',
    hasPassword: !!val.pass,
    fromEmail: val.fromEmail || '',
    fromName: val.fromName || '',
    whatsappGroupLink: val.whatsappGroupLink || '',
    platformUrl: val.platformUrl || ''
  });
}

// 13. POST /api/portal/settings/smtp (Global Admin)
async function saveSMTPSettings(req, res) {
  if (!hasGlobalScope(req.permissionScopes)) {
    throw httpError(403, 'Unauthorized. Admin settings only.');
  }

  const {
    host, port, secure, user, pass, fromEmail, fromName,
    whatsappGroupLink, platformUrl
  } = req.body;

  if (!host || !port || !user || !fromEmail || !fromName) {
    throw httpError(400, 'host, port, user, fromEmail and fromName are required');
  }

  // Fetch existing settings first to preserve password if unchanged
  const existingRes = await db.query("SELECT value FROM system_settings WHERE key = 'smtp'");
  let finalPass = pass;
  
  if (pass === '__UNCHANGED__') {
    if (existingRes.rowCount > 0 && existingRes.rows[0].value.pass) {
      finalPass = existingRes.rows[0].value.pass;
    } else {
      throw httpError(400, 'Password is required because no prior password exists');
    }
  }

  const configValue = {
    host,
    port: parseInt(port, 10),
    secure: secure === true,
    user,
    pass: finalPass || '',
    fromEmail,
    fromName,
    whatsappGroupLink: whatsappGroupLink || '',
    platformUrl: platformUrl || ''
  };

  await db.query(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ('smtp', $1, now())
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `, [JSON.stringify(configValue)]);

  res.json({ message: 'SMTP settings saved successfully' });
}

// 14. POST /api/portal/settings/smtp/test (Global Admin)
async function testSMTPSettings(req, res) {
  if (!hasGlobalScope(req.permissionScopes)) {
    throw httpError(403, 'Unauthorized. Admin settings only.');
  }

  const { testEmail } = req.body;

  // Retrieve configured SMTP settings to find default recipient
  const settingsRes = await db.query("SELECT value FROM system_settings WHERE key = 'smtp'");
  let configEmail = null;
  if (settingsRes.rowCount > 0) {
    const config = settingsRes.rows[0].value;
    configEmail = config.fromEmail || config.user;
  }

  const recipientEmail = testEmail || configEmail || req.user.email;

  // Create a mock application matching the recipient and mock credentials
  const mockApplication = {
    full_name: req.user.full_name,
    email: recipientEmail,
    kind: 'board',
    desired_role: 'System Administrator (Test Role)'
  };

  const mockCredentials = {
    username: req.user.username,
    temporaryPassword: 'TestPassword123!',
    groupCode: 'T1'
  };

  // We await this so if it throws, the error is returned to the user
  try {
    await sendAcceptanceEmail(mockApplication, mockCredentials, true);
  } catch (err) {
    throw httpError(400, `SMTP Connection failed: ${err.message}`);
  }

  res.json({ message: `Test email sent successfully to ${recipientEmail}!` });
}

module.exports = {
  getDashboardStats,
  getGroupSessions,
  createGroupSession,
  getSessionAttendance,
  saveSessionAttendance,
  getGroupAssignments,
  createAssignment,
  getAssignmentSubmissions,
  submitAssignment,
  gradeSubmission,
  getMyMetrics,
  getSMTPSettings,
  saveSMTPSettings,
  testSMTPSettings
};
