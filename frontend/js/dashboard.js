/**
 * Microsoft Campus Club - KFS
 * Dashboard Controller (Overview, Stats, Mentor, Student Portals)
 * File: frontend/js/dashboard.js
 */

let currentUser = null;
let userRoles = [];
let allGroups = [];
let selectedGroupId = null;

// Auth check at startup
if (!Session.isAuthenticated()) {
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  // Logout handler
  document.getElementById('logout-btn').addEventListener('click', () => {
    Session.clear();
    window.location.href = 'login.html';
  });

  try {
    const data = await apiRequest('/auth/me');
    currentUser = data.user;
    userRoles = data.roles || [];

    // Render basic user details
    document.getElementById('sidebar-name').textContent = currentUser.full_name;
    document.getElementById('sidebar-email').textContent = currentUser.email;
    document.getElementById('sidebar-avatar').textContent = currentUser.full_name.charAt(0).toUpperCase();

    document.getElementById('header-name').textContent = currentUser.full_name;
    document.getElementById('info-full-name').textContent = currentUser.full_name;
    document.getElementById('info-email').textContent = currentUser.email;
    document.getElementById('info-username').textContent = currentUser.username;
    
    let statusText = 'Staff / Board';
    if (currentUser.member_status === 'student') statusText = 'Student Member';
    else if (currentUser.member_status === 'graduate') statusText = 'Graduate Member';
    document.getElementById('info-status').textContent = statusText;

    // Render roles table
    const rolesBody = document.getElementById('roles-body');
    rolesBody.innerHTML = '';
    if (userRoles.length === 0) {
      document.getElementById('roles-empty').style.display = 'block';
    } else {
      userRoles.forEach(r => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${r.name}</strong></td>
          <td>${r.scopeType}</td>
          <td><span style="font-size:11px; font-family:var(--font-code); color:var(--muted);">${r.scopeId || 'Global'}</span></td>
        `;
        rolesBody.appendChild(row);
      });
    }

    // Determine permissions and load appropriate portals
    const isGlobalAdmin = userRoles.some(r => r.scopeType === 'global');
    const isStudent = userRoles.some(r => r.code === 'member');
    const isMentorOrLead = userRoles.some(r => ['mentor', 'unit_lead', 'unit_vice_lead', 'department_director', 'full_access'].includes(r.code));

    // Sidebar visibility: show admin links only to global admins
    if (!isGlobalAdmin) {
      const hide = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
      hide('nav-apps');
      hide('nav-users');
      hide('nav-settings');
    }

    if (isGlobalAdmin) {
      // Load global admin dashboard
      document.getElementById('admin-dashboard').style.display = 'block';
      await loadAdminDashboard();
    }

    // Load student portal
    if (isStudent) {
      document.getElementById('student-portal').style.display = 'block';
      await loadStudentPortal();
    }

    // Load mentor portal
    if (isMentorOrLead) {
      document.getElementById('mentor-portal').style.display = 'block';
      await initMentorPortal();
    }

  } catch (err) {
    console.error('Failed to load dashboard data', err);
  }
});

// ============================================================================
// 1. Admin Dashboard Stats
// ============================================================================
async function loadAdminDashboard() {
  try {
    const stats = await apiRequest('/portal/dashboard/stats');

    document.getElementById('stat-board-members').textContent = stats.boardMembers;
    document.getElementById('stat-student-members').textContent = stats.studentMembers;
    document.getElementById('stat-groups').textContent = stats.totalGroups;
    document.getElementById('stat-pending-apps').textContent = stats.applications.pending;
    document.getElementById('stat-apps-sub').textContent =
      `${stats.applications.accepted} accepted · ${stats.applications.rejected} rejected`;
    document.getElementById('stat-attendance-rate').textContent = `${stats.attendanceRate}%`;
    document.getElementById('stat-absent-sub').textContent = `absent rate: ${stats.absentRate}%`;
    document.getElementById('stat-tasks-rate').textContent = `${stats.taskSubmissionRate}%`;

    // Group Attendance Breakdown
    const groupBody = document.getElementById('group-attendance-body');
    groupBody.innerHTML = '';
    if (!stats.groupAttendance || stats.groupAttendance.length === 0) {
      groupBody.innerHTML = '<tr><td colspan="5" class="empty-state">No attendance data yet.</td></tr>';
    } else {
      stats.groupAttendance.forEach(g => {
        const absentPct = parseFloat(g.absentRate);
        const color = absentPct >= 50 ? 'var(--danger)' : absentPct >= 25 ? '#e67e22' : 'var(--success)';
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${g.groupName}</strong></td>
          <td>${g.unitName}</td>
          <td>${g.presentCount}</td>
          <td>${g.absentCount}</td>
          <td><span style="font-weight:700; color:${color};">${absentPct}%</span></td>
        `;
        groupBody.appendChild(row);
      });
    }

    // Recent Applications
    const recentAppsBody = document.getElementById('recent-apps-body');
    recentAppsBody.innerHTML = '';
    if (stats.recentApplications.length === 0) {
      recentAppsBody.innerHTML = '<tr><td colspan="4" class="empty-state">No recent applications.</td></tr>';
    } else {
      stats.recentApplications.forEach(app => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${app.fullName}</strong></td>
          <td>${app.kind === 'board' ? 'Board / Staff' : 'Student Member'}</td>
          <td><span class="status-badge status-${app.status}">${app.status}</span></td>
          <td>${new Date(app.submittedAt).toLocaleDateString()}</td>
        `;
        recentAppsBody.appendChild(row);
      });
    }

  } catch (err) {
    console.error('Failed to load admin stats', err);
  }
}

// ============================================================================
// 2. Student Portal logic
// ============================================================================
async function loadStudentPortal() {
  try {
    const data = await apiRequest('/portal/my-metrics');
    
    // Set Group Info
    if (data.group) {
      document.getElementById('student-track-name').textContent = data.group.trackName;
      document.getElementById('student-group-name').textContent = data.group.groupName;
      
      const mentorsText = data.group.mentors
        .map(m => `${m.fullName} (${m.email})`)
        .join(', ') || 'No mentor assigned yet.';
      document.getElementById('student-mentor-names').textContent = mentorsText;
      
      // Load assignments and sessions for group
      const memberRole = userRoles.find(r => r.code === 'member');
      const studentGroupId = memberRole ? memberRole.scopeId : null;
      if (studentGroupId) {
        await loadStudentSessionsAndAssignments(studentGroupId);
      }
    } else {
      document.getElementById('student-group-card').innerHTML = '<p class="empty-state">You are not currently enrolled in any learning group.</p>';
    }

    // Render Attendance
    const attendanceBody = document.getElementById('student-attendance-body');
    attendanceBody.innerHTML = '';
    if (data.attendance.length === 0) {
      attendanceBody.innerHTML = '<tr><td colspan="3" class="empty-state">No attendance recorded.</td></tr>';
    } else {
      data.attendance.forEach(att => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${att.sessionTitle}</strong></td>
          <td>${new Date(att.sessionDate).toLocaleDateString()}</td>
          <td><span class="user-badge status-${att.status === 'present' ? 'active' : att.status === 'excused' ? 'suspended' : 'disabled'}">${att.status || 'absent'}</span></td>
        `;
        attendanceBody.appendChild(row);
      });
    }

    // Render Grades
    const gradesBody = document.getElementById('student-grades-body');
    gradesBody.innerHTML = '';
    const gradedOnly = data.submissions.filter(s => s.grade !== null);
    if (gradedOnly.length === 0) {
      gradesBody.innerHTML = '<tr><td colspan="3" class="empty-state">No graded tasks yet.</td></tr>';
    } else {
      gradedOnly.forEach(sub => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${sub.assignmentTitle}</strong></td>
          <td><span class="grade-tag graded">${sub.grade} / 100</span></td>
          <td><span style="font-size:12px; color:var(--muted);">${sub.feedback || 'No comments.'}</span></td>
        `;
        gradesBody.appendChild(row);
      });
    }

  } catch (err) {
    console.error('Failed to load student portal data', err);
  }
}

async function loadStudentSessionsAndAssignments(groupId) {
  try {
    // 1. Load Sessions (for meeting banner)
    const sessionsData = await apiRequest(`/portal/groups/${groupId}/sessions`);
    const sessions = sessionsData.sessions || [];
    const banner = document.getElementById('student-meeting-link');
    if (sessions.length > 0) {
      const latest = sessions[0];
      document.getElementById('student-session-title').textContent = latest.title;
      document.getElementById('student-meeting-url').href = latest.meeting_url;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }

    // 2. Load Tasks/Assignments
    const assignmentsData = await apiRequest(`/portal/groups/${groupId}/assignments`);
    const assignments = assignmentsData.assignments || [];
    const taskList = document.getElementById('student-tasks-list');
    taskList.innerHTML = '';

    if (assignments.length === 0) {
      taskList.innerHTML = '<p class="empty-state">No tasks assigned yet.</p>';
      return;
    }

    assignments.forEach(task => {
      const item = document.createElement('div');
      item.className = 'task-item';
      
      let submissionStatus = '<span class="grade-tag missing">Not Submitted</span>';
      let submitButton = `<button class="btn-small" style="background:var(--primary); color:#fff; font-size:12px;" onclick="openSubmitModal('${task.id}', '${task.title.replace(/'/g, "\\'")}')">Submit Work</button>`;

      const sub = task.mySubmission;
      if (sub && sub.id) {
        if (sub.grade !== null) {
          submissionStatus = `<span class="grade-tag graded">Graded: ${sub.grade} / 100</span>`;
          submitButton = `<div style="font-size:12px; color:var(--muted);">Feedback: <em>${sub.feedback || 'None'}</em></div>`;
        } else {
          submissionStatus = '<span class="grade-tag pending">Submitted (Pending grade)</span>';
          submitButton = `<button class="btn-small" style="background:var(--muted); color:#fff; font-size:12px;" onclick="openSubmitModal('${task.id}', '${task.title.replace(/'/g, "\\'")}')">Resubmit Work</button>`;
        }
      }

      item.innerHTML = `
        <div class="task-header">
          <div>
            <div class="task-title">${task.title}</div>
            <div class="task-due">Due: ${task.due_date ? new Date(task.due_date).toLocaleString() : 'No deadline'}</div>
          </div>
          <div>${submissionStatus}</div>
        </div>
        <div class="task-desc">${task.description}</div>
        <div>${submitButton}</div>
      `;
      taskList.appendChild(item);
    });

  } catch (err) {
    console.error('Failed to load group sessions/tasks', err);
  }
}

// Open modal for student to submit assignment
function openSubmitModal(assignmentId, title) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal" style="max-width: 450px;">
        <h3>Submit Assignment</h3>
        <p>Task: <strong>${title}</strong></p>
        <div class="modal-error" id="submit-error" style="color:var(--danger); font-size:13px; margin-bottom:12px;"></div>
        <form id="submission-form-modal">
          <div class="field">
            <label>Description / Notes</label>
            <textarea id="submissionText" style="width:100%; height:80px; resize:none; padding:10px; border-radius:var(--radius); border:1px solid var(--line); font-family:var(--font-body); font-size:14px;" placeholder="Briefly describe your submission..." required></textarea>
          </div>
          <div class="field">
            <label>Submission Link (GitHub, Google Drive, etc.)</label>
            <input type="url" id="submissionUrl" placeholder="https://..." required>
          </div>
          <div class="modal-actions" style="margin-top:20px;">
            <button type="button" class="btn-secondary" id="btn-cancel-submit">Cancel</button>
            <button type="submit" class="btn-primary">Submit</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('btn-cancel-submit').addEventListener('click', () => {
    root.innerHTML = '';
  });

  document.getElementById('submission-form-modal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('submit-error');
    errorBox.textContent = '';

    const submissionText = document.getElementById('submissionText').value.trim();
    const submissionUrl = document.getElementById('submissionUrl').value.trim();

    try {
      await apiRequest(`/portal/assignments/${assignmentId}/submissions`, {
        method: 'POST',
        body: JSON.stringify({ submissionText, submissionUrl })
      });
      root.innerHTML = '';
      await loadStudentPortal(); // reload portal metrics
    } catch (err) {
      errorBox.textContent = err.message || 'Failed to submit assignment.';
    }
  });
}

// ============================================================================
// 3. Mentor / Lead Portal logic
// ============================================================================
async function initMentorPortal() {
  try {
    // Fetch all active groups in system
    const data = await apiRequest('/groups');
    const groups = data.groups || [];

    // Filter groups where the logged-in user is authorized
    const authGroups = getAuthorizedGroups(groups, userRoles);
    
    const selector = document.getElementById('mentor-group-selector');
    selector.innerHTML = '<option value="">Choose a group...</option>';
    
    authGroups.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = `${g.name} (${g.unit_name})`;
      selector.appendChild(opt);
    });

    // Group Selector change handler
    selector.addEventListener('change', () => {
      selectedGroupId = selector.value;
      const mgmt = document.getElementById('mentor-group-management');
      if (selectedGroupId) {
        mgmt.style.display = 'block';
        loadGroupManagementData(selectedGroupId);
      } else {
        mgmt.style.display = 'none';
      }
    });

    // Meeting Link Form submit
    document.getElementById('session-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('session-error');
      errBox.textContent = '';
      
      const title = document.getElementById('session-title').value.trim();
      const meetingUrl = document.getElementById('session-meeting-url').value.trim();

      try {
        await apiRequest(`/portal/groups/${selectedGroupId}/sessions`, {
          method: 'POST',
          body: JSON.stringify({ title, meetingUrl })
        });
        document.getElementById('session-title').value = '';
        document.getElementById('session-meeting-url').value = '';
        await loadMentorSessions(selectedGroupId);
      } catch (err) {
        errBox.textContent = err.message || 'Failed to post session.';
        errBox.classList.add('visible');
      }
    });

    // Assignment Form submit
    document.getElementById('assignment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('assignment-error');
      errBox.textContent = '';

      const title = document.getElementById('assignment-title').value.trim();
      const description = document.getElementById('assignment-description').value.trim();
      const dueDate = document.getElementById('assignment-due-date').value || null;

      try {
        await apiRequest(`/portal/groups/${selectedGroupId}/assignments`, {
          method: 'POST',
          body: JSON.stringify({ title, description, dueDate })
        });
        document.getElementById('assignment-title').value = '';
        document.getElementById('assignment-description').value = '';
        document.getElementById('assignment-due-date').value = '';
        await loadMentorAssignments(selectedGroupId);
      } catch (err) {
        errBox.textContent = err.message || 'Failed to publish assignment.';
        errBox.classList.add('visible');
      }
    });

  } catch (err) {
    console.error('Failed to initialize mentor portal', err);
  }
}

function getAuthorizedGroups(groups, roles) {
  if (roles.some(r => r.scopeType === 'global')) return groups;
  return groups.filter(g => {
    return roles.some(r => {
      if (r.scopeType === 'group' && r.scopeId === g.id) return true;
      if (r.scopeType === 'unit' && r.scopeId === g.unit_id) return true;
      if (r.scopeType === 'department' && r.scopeId === g.department_id) return true;
      return false;
    });
  });
}

async function loadGroupManagementData(groupId) {
  await Promise.all([
    loadMentorSessions(groupId),
    loadMentorAssignments(groupId)
  ]);
}

async function loadMentorSessions(groupId) {
  try {
    const data = await apiRequest(`/portal/groups/${groupId}/sessions`);
    const sessions = data.sessions || [];
    const tbody = document.getElementById('mentor-sessions-body');
    tbody.innerHTML = '';

    if (sessions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No sessions created yet.</td></tr>';
      return;
    }

    sessions.forEach(s => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${s.title}</strong></td>
        <td><a href="${s.meeting_url}" target="_blank">${s.meeting_url}</a></td>
        <td>${new Date(s.session_date).toLocaleDateString()}</td>
        <td><button class="btn-small" style="background:var(--primary); color:#fff;" onclick="openAttendanceModal('${s.id}', '${s.title.replace(/'/g, "\\'")}')">Mark Attendance</button></td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Failed to load mentor sessions', err);
  }
}

async function loadMentorAssignments(groupId) {
  try {
    const data = await apiRequest(`/portal/groups/${groupId}/assignments`);
    const assignments = data.assignments || [];
    const list = document.getElementById('mentor-tasks-list');
    list.innerHTML = '';

    if (assignments.length === 0) {
      list.innerHTML = '<p class="empty-state">No tasks created yet.</p>';
      return;
    }

    assignments.forEach(task => {
      const item = document.createElement('div');
      item.className = 'task-item';
      item.innerHTML = `
        <div class="task-header">
          <div>
            <div class="task-title">${task.title}</div>
            <div class="task-due">Due: ${task.due_date ? new Date(task.due_date).toLocaleString() : 'No deadline'}</div>
          </div>
          <div><button class="btn-small" style="background:var(--maroon); color:#fff;" onclick="openSubmissionsModal('${task.id}', '${task.title.replace(/'/g, "\\'")}')">Review Submissions</button></div>
        </div>
        <div class="task-desc">${task.description}</div>
      `;
      list.appendChild(item);
    });
  } catch (err) {
    console.error('Failed to load mentor assignments', err);
  }
}

// Attendance Modal
async function openAttendanceModal(sessionId, title) {
  const root = document.getElementById('modal-root');
  
  try {
    const data = await apiRequest(`/portal/sessions/${sessionId}/attendance`);
    const list = data.attendance || [];
    
    let tableRows = '';
    if (list.length === 0) {
      tableRows = '<tr><td colspan="3" class="empty-state">No active members in this group.</td></tr>';
    } else {
      list.forEach(m => {
        tableRows += `
          <tr data-user-id="${m.userId}">
            <td><strong>${m.fullName}</strong></td>
            <td>${m.email}</td>
            <td>
              <select class="attendance-select" style="padding:4px; font-size:12px;">
                <option value="absent" ${m.status === 'absent' || !m.status ? 'selected' : ''}>Absent</option>
                <option value="present" ${m.status === 'present' ? 'selected' : ''}>Present</option>
                <option value="excused" ${m.status === 'excused' ? 'selected' : ''}>Excused</option>
              </select>
            </td>
          </tr>
        `;
      });
    }

    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal" style="max-width: 600px;">
          <h3>Mark Attendance</h3>
          <p>Session: <strong>${title}</strong></p>
          <div class="modal-error" id="attendance-error-box" style="color:var(--danger); font-size:13px; margin-bottom:12px;"></div>
          
          <table class="roles-table" style="margin-bottom:20px;">
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Email</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="attendance-list-body">${tableRows}</tbody>
          </table>

          <div class="modal-actions">
            <button class="btn-secondary" id="btn-close-attendance">Cancel</button>
            <button class="btn-primary" id="btn-save-attendance">Save Attendance</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-close-attendance').addEventListener('click', () => {
      root.innerHTML = '';
    });

    document.getElementById('btn-save-attendance').addEventListener('click', async () => {
      const errorBox = document.getElementById('attendance-error-box');
      errorBox.textContent = '';

      const rows = document.querySelectorAll('#attendance-list-body tr');
      const attendance = [];
      rows.forEach(r => {
        const userId = r.dataset.userId;
        if (!userId) return;
        const status = r.querySelector('.attendance-select').value;
        attendance.push({ userId, status });
      });

      try {
        await apiRequest(`/portal/sessions/${sessionId}/attendance`, {
          method: 'POST',
          body: JSON.stringify({ attendance })
        });
        root.innerHTML = '';
      } catch (err) {
        errorBox.textContent = err.message || 'Failed to save attendance.';
      }
    });

  } catch (err) {
    alert(err.message || 'Failed to load attendance list.');
  }
}

// Submissions Modal
async function openSubmissionsModal(assignmentId, title) {
  const root = document.getElementById('modal-root');
  
  try {
    const data = await apiRequest(`/portal/assignments/${assignmentId}/submissions`);
    const list = data.submissions || [];
    
    let rows = '';
    if (list.length === 0) {
      rows = '<tr><td colspan="4" class="empty-state">No members enrolled.</td></tr>';
    } else {
      list.forEach(s => {
        let status = '<span class="grade-tag missing">No Submission</span>';
        let action = '—';
        
        if (s.submissionId) {
          if (s.grade !== null) {
            status = `<span class="grade-tag graded">Graded: ${s.grade} / 100</span>`;
            action = `<button class="btn-small" style="background:var(--amber); color:#fff;" onclick="openGradeModal('${s.submissionId}', '${s.fullName}', '${s.grade}', '${(s.feedback || '').replace(/'/g, "\\'")}')">Re-grade</button>`;
          } else {
            status = '<span class="grade-tag pending">Submitted</span>';
            action = `<button class="btn-small" style="background:var(--success); color:#fff;" onclick="openGradeModal('${s.submissionId}', '${s.fullName}')">Grade</button>`;
          }
          status += `<br><span style="font-size:11px; color:var(--muted);">Desc: ${s.submissionText || 'N/A'}<br><a href="${s.submissionUrl}" target="_blank">View File / Code</a></span>`;
        }

        rows += `
          <tr>
            <td><strong>${s.fullName}</strong></td>
            <td>${s.email}</td>
            <td>${status}</td>
            <td>${action}</td>
          </tr>
        `;
      });
    }

    root.innerHTML = `
      <div class="modal-overlay">
        <div class="modal" style="max-width: 700px;">
          <h3>Review Student Submissions</h3>
          <p>Task: <strong>${title}</strong></p>
          
          <table class="roles-table" style="margin-bottom:20px;">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Submission Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>

          <div class="modal-actions">
            <button class="btn-secondary" id="btn-close-subs" style="width:100%;">Close</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-close-subs').addEventListener('click', () => {
      root.innerHTML = '';
    });

  } catch (err) {
    alert(err.message || 'Failed to load submissions.');
  }
}

// Grading Form Modal
function openGradeModal(submissionId, studentName, currentGrade = '', currentFeedback = '') {
  const root = document.getElementById('modal-root');
  
  // We temporarily save the overlay for backing up later
  const backupHtml = root.innerHTML;
  
  const gradeOverlay = document.createElement('div');
  gradeOverlay.className = 'modal-overlay';
  gradeOverlay.style.zIndex = '1000'; // draw above submissions list
  gradeOverlay.innerHTML = `
    <div class="modal" style="max-width: 400px; padding:24px;">
      <h3>Grade Submission</h3>
      <p>Student: <strong>${studentName}</strong></p>
      <div class="modal-error" id="grade-error-box" style="color:var(--danger); font-size:13px; margin-bottom:12px;"></div>
      <form id="grade-form-modal">
        <div class="field">
          <label>Grade / Score (0 to 100)</label>
          <input type="number" id="grade-score" min="0" max="100" value="${currentGrade}" required>
        </div>
        <div class="field">
          <label>Feedback / Comments</label>
          <textarea id="grade-feedback" style="width:100%; height:80px; resize:none; padding:10px; border-radius:var(--radius); border:1px solid var(--line); font-family:var(--font-body); font-size:14px;">${currentFeedback}</textarea>
        </div>
        <div class="modal-actions" style="margin-top:20px;">
          <button type="button" class="btn-secondary" id="btn-cancel-grade">Cancel</button>
          <button type="submit" class="btn-primary">Submit Grade</button>
        </div>
      </form>
    </div>
  `;

  root.appendChild(gradeOverlay);

  document.getElementById('btn-cancel-grade').addEventListener('click', () => {
    gradeOverlay.remove();
  });

  document.getElementById('grade-form-modal').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById('grade-error-box');
    errorBox.textContent = '';

    const grade = parseFloat(document.getElementById('grade-score').value);
    const feedback = document.getElementById('grade-feedback').value.trim();

    try {
      await apiRequest(`/portal/submissions/${submissionId}/grade`, {
        method: 'PATCH',
        body: JSON.stringify({ grade, feedback })
      });
      root.innerHTML = ''; // close both modals
      loadGroupManagementData(selectedGroupId); // reload assignments list
    } catch (err) {
      errorBox.textContent = err.message || 'Failed to submit grade.';
    }
  });
}
