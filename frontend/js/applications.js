/**
 * Microsoft Campus Club - KFS
 * Applications Review Page JavaScript
 * File: frontend/js/applications.js
 */

requireAuth();

let allApps = [];

function initials(fullName) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function renderSidebarUser() {
  document.getElementById('sidebar-name').textContent = currentUser.full_name;
  document.getElementById('sidebar-email').textContent = currentUser.email;
  document.getElementById('sidebar-avatar').textContent = initials(currentUser.full_name);
}

// Check window statuses and set toggles
async function loadWindowStatuses() {
  try {
    const status = await apiRequest('/applications/status');
    
    const toggleBoard = document.getElementById('toggle-board');
    const toggleMember = document.getElementById('toggle-member');
    
    toggleBoard.checked = status.board.isOpen;
    document.getElementById('status-board-text').textContent = status.board.isOpen ? 'Open (Accepting board applications)' : 'Closed';
    
    toggleMember.checked = status.member.isOpen;
    document.getElementById('status-member-text').textContent = status.member.isOpen ? 'Open (Accepting member applications)' : 'Closed';
  } catch (err) {
    console.error('Failed to load window statuses', err);
  }
}

// Toggle application windows
async function handleToggleWindow(kind, isOpen) {
  try {
    await apiRequest(`/applications/windows/${kind}`, {
      method: 'PATCH',
      body: JSON.stringify({ isOpen })
    });
    await loadWindowStatuses();
  } catch (err) {
    alert(err.message || 'Failed to update application window.');
    await loadWindowStatuses(); // Reset toggle UI
  }
}

// Show application full details modal
function openDetailsModal(app) {
  const root = document.getElementById('modal-root');
  
  let conditionalFields = '';
  if (app.member_status === 'student') {
    conditionalFields = `
      <dt style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:600; margin-top:8px;">University</dt>
      <dd style="margin:4px 0 0; color:var(--ink); font-size:14px;">${app.university_name || 'N/A'} (Year: ${app.university_year || 'N/A'})</dd>
    `;
  } else if (app.member_status === 'graduate') {
    conditionalFields = `
      <dt style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:600; margin-top:8px;">Company / Job</dt>
      <dd style="margin:4px 0 0; color:var(--ink); font-size:14px;">${app.company_name || 'N/A'} (${app.job_title || 'N/A'})</dd>
    `;
  }

  let choiceDetails = '';
  if (app.kind === 'board') {
    choiceDetails = `
      <dt style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:600; margin-top:8px;">Desired Department</dt>
      <dd style="margin:4px 0 0; color:var(--ink); font-size:14px;">${app.desiredDepartmentName || 'N/A'}</dd>
      <dt style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:600; margin-top:8px;">Desired Position</dt>
      <dd style="margin:4px 0 0; color:var(--ink); font-size:14px;">${app.desired_role || 'N/A'}</dd>
    `;
  } else {
    choiceDetails = `
      <dt style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:600; margin-top:8px;">Desired Track</dt>
      <dd style="margin:4px 0 0; color:var(--ink); font-size:14px;">${app.desiredUnitName || 'N/A'}</dd>
    `;
  }

  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal" style="max-width: 500px; padding: 26px;">
        <h3 style="margin-top:0; font-family:var(--font-display); font-size:18px;">Application Details</h3>
        <p style="margin:0 0 16px; font-size:14px; color:var(--muted);">Submitted by <strong>${app.full_name}</strong></p>
        
        <div style="background:var(--page); border:1px solid var(--line); border-radius:var(--radius); padding:16px; margin-bottom:20px;">
          <dl style="margin:0; display:grid; grid-template-columns:1fr; gap:12px;">
            <div>
              <dt style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:600;">Contact Information</dt>
              <dd style="margin:4px 0 0; color:var(--ink); font-size:14px;">Email: ${app.email}<br>Phone: ${app.phone_number}</dd>
            </div>
            
            <div>
              <dt style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:600;">Status & Profile</dt>
              <dd style="margin:4px 0 0; color:var(--ink); font-size:14px;">${app.member_status || 'Staff'}</dd>
              ${conditionalFields}
            </div>

            <div>
              <dt style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:600;">Club Placement Choice</dt>
              <dd style="margin:4px 0 0; color:var(--ink); font-size:14px;">${choiceDetails}</dd>
            </div>

            <div>
              <dt style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:600;">How did you hear about us?</dt>
              <dd style="margin:4px 0 0; color:var(--ink); font-size:14px;">${app.referral_source || 'N/A'}</dd>
            </div>

            <div>
              <dt style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:600;">Why do you want to join?</dt>
              <dd style="margin:4px 0 0; color:var(--ink); font-size:14px; line-height:1.4; white-space:pre-wrap;">${app.why_join || 'N/A'}</dd>
            </div>

            <div>
              <dt style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:600;">Skills & Experience</dt>
              <dd style="margin:4px 0 0; color:var(--ink); font-size:14px; line-height:1.4; white-space:pre-wrap;">${app.skills || 'N/A'}</dd>
            </div>

            ${app.linkedin_url ? `
            <div>
              <dt style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:600;">LinkedIn</dt>
              <dd style="margin:4px 0 0; color:var(--ink); font-size:14px;"><a href="${app.linkedin_url}" target="_blank">${app.linkedin_url}</a></dd>
            </div>` : ''}

            ${app.github_url ? `
            <div>
              <dt style="font-size:11px; text-transform:uppercase; color:var(--muted); font-weight:600;">GitHub</dt>
              <dd style="margin:4px 0 0; color:var(--ink); font-size:14px;"><a href="${app.github_url}" target="_blank">${app.github_url}</a></dd>
            </div>` : ''}
          </dl>
        </div>
        
        <div class="modal-actions" style="margin-top:0;">
          <button type="button" class="btn-primary" id="btn-close-details" style="width:100%;">Close</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-close-details').addEventListener('click', () => {
    root.innerHTML = '';
  });
}

// Fetch and render applications
async function loadApplications() {
  const tbody = document.getElementById('applications-body');
  const emptyState = document.getElementById('applications-empty');
  
  tbody.innerHTML = '<tr><td colspan="6" class="loading-state">Loading applications...</td></tr>';
  emptyState.style.display = 'none';

  const kind = document.getElementById('filter-kind').value;
  const status = document.getElementById('filter-status').value;

  let url = '/applications';
  const params = [];
  if (kind) params.push(`kind=${kind}`);
  if (status) params.push(`status=${status}`);
  if (params.length) url += `?${params.join('&')}`;

  try {
    const data = await apiRequest(url);
    allApps = data.applications;
    
    tbody.innerHTML = '';
    
    if (allApps.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    allApps.forEach(app => {
      const row = document.createElement('tr');

      // Date
      const dateCell = document.createElement('td');
      dateCell.textContent = new Date(app.submitted_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      row.appendChild(dateCell);

      // Name & Status Info
      const nameCell = document.createElement('td');
      nameCell.innerHTML = `<strong>${app.full_name}</strong><br><span style="font-size:12px; color:var(--muted);">${app.member_status || 'Staff'}</span>`;
      row.appendChild(nameCell);

      // Type
      const typeCell = document.createElement('td');
      typeCell.textContent = app.kind === 'board' ? 'Board' : 'Member';
      row.appendChild(typeCell);

      // Email & Phone
      const contactCell = document.createElement('td');
      contactCell.innerHTML = `${app.email}<br><span style="font-size:12px; color:var(--muted);">${app.phone_number}</span>`;
      row.appendChild(contactCell);

      // Status / Track / Department
      const statusCell = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `status-badge status-${app.status}`;
      badge.textContent = app.status;
      statusCell.appendChild(badge);

      let placementInfo = '';
      if (app.kind === 'member' && app.desiredUnitName) {
        placementInfo = `<br><span style="font-size:12px; color:var(--muted);">Track: ${app.desiredUnitName}</span>`;
      } else if (app.kind === 'board' && app.desiredDepartmentName) {
        placementInfo = `<br><span style="font-size:12px; color:var(--muted);">Dept: ${app.desiredDepartmentName} (${app.desired_role})</span>`;
      }
      statusCell.innerHTML += placementInfo;
      row.appendChild(statusCell);

      // Actions
      const actionsCell = document.createElement('td');
      
      const viewBtn = document.createElement('button');
      viewBtn.className = 'btn-small';
      viewBtn.style.marginRight = '8px';
      viewBtn.style.background = 'var(--bg-soft)';
      viewBtn.style.color = '#ffffff';
      viewBtn.textContent = 'View';
      viewBtn.addEventListener('click', () => openDetailsModal(app));
      actionsCell.appendChild(viewBtn);

      if (app.status === 'pending') {
        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'btn-small';
        acceptBtn.style.marginRight = '8px';
        acceptBtn.style.background = 'var(--success)';
        acceptBtn.style.color = '#ffffff';
        acceptBtn.textContent = 'Accept';
        acceptBtn.addEventListener('click', () => openDecisionModal(app, 'accepted'));
        
        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'btn-small';
        rejectBtn.style.background = 'var(--danger)';
        rejectBtn.style.color = '#ffffff';
        rejectBtn.textContent = 'Reject';
        rejectBtn.addEventListener('click', () => openDecisionModal(app, 'rejected'));

        actionsCell.appendChild(acceptBtn);
        actionsCell.appendChild(rejectBtn);
      }
      row.appendChild(actionsCell);

      tbody.appendChild(row);
    });

  } catch (err) {
    tbody.innerHTML = '';
    emptyState.textContent = err.message || 'Failed to load applications.';
    emptyState.style.display = 'block';
  }
}

// Show Accept/Reject Modal
function openDecisionModal(app, decision) {
  const root = document.getElementById('modal-root');
  
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal">
        <h3>${decision === 'accepted' ? 'Accept Application' : 'Reject Application'}</h3>
        <p>Are you sure you want to <strong>${decision}</strong> the application of <strong>${app.full_name}</strong>?</p>
        <div class="modal-error" id="decision-error"></div>
        
        <form id="decision-form">
          <div class="field">
            <label for="decision-notes">Review Notes (optional)</label>
            <textarea id="decision-notes" style="width:100%; height:80px; padding:10px; border-radius:var(--radius); border:1px solid var(--line); font-family:var(--font-body); font-size:14px; background:#fbfcfe; resize:none;"></textarea>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="btn-close-decision">Cancel</button>
            <button type="submit" class="btn-primary" style="background:${decision === 'accepted' ? 'var(--success)' : 'var(--danger)'}">
              Confirm ${decision === 'accepted' ? 'Acceptance' : 'Rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('btn-close-decision').addEventListener('click', () => {
    root.innerHTML = '';
  });

  const form = document.getElementById('decision-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorDiv = document.getElementById('decision-error');
    errorDiv.style.display = 'none';
    
    const notes = document.getElementById('decision-notes').value;
    
    try {
      const res = await apiRequest(`/applications/${app.id}/decision`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, notes })
      });

      if (decision === 'accepted') {
        showCredentialsModal(app, res);
      } else {
        root.innerHTML = '';
        loadApplications();
      }
    } catch (err) {
      errorDiv.textContent = err.message || 'An error occurred while saving decision.';
      errorDiv.style.display = 'block';
    }
  });
}

// Show generated credentials modal
function showCredentialsModal(app, res) {
  const root = document.getElementById('modal-root');
  const trackPart = app.desiredUnitName ? `<dt>Assigned Track & Group</dt><dd>${app.desiredUnitName} (Group ${res.groupCode || 'N/A'})</dd>` : '';
  
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="credentials-modal">
        <h3 style="color:var(--success); margin-top:0; margin-bottom:10px;">Application Accepted!</h3>
        <p>An account has been created for <strong>${app.full_name}</strong>.</p>
        
        <div class="credentials-box">
          <button class="copy-btn" id="btn-copy-creds">Copy</button>
          <dl style="margin:0;">
            <dt>Username</dt>
            <dd id="cred-username" style="font-size:16px;">${res.username}</dd>
            <dt>Temporary Password</dt>
            <dd id="cred-password" style="font-size:16px;">${res.temporaryPassword}</dd>
            ${trackPart}
          </dl>
        </div>
        
        <p style="font-size:13px; color:var(--muted); line-height:1.5; margin-bottom:20px;">
          Copy these credentials and share them with the candidate. This temporary password will not be shown again.
        </p>
        
        <div class="modal-actions">
          <button class="btn-primary" id="btn-close-creds" style="width:100%;">Done</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-copy-creds').addEventListener('click', () => {
    const text = `Username: ${res.username}\nPassword: ${res.temporaryPassword}${app.desiredUnitName ? `\nTrack: ${app.desiredUnitName} (Group ${res.groupCode})` : ''}`;
    navigator.clipboard.writeText(text);
    document.getElementById('btn-copy-creds').textContent = 'Copied!';
    setTimeout(() => {
      document.getElementById('btn-copy-creds').textContent = 'Copy';
    }, 2000);
  });

  document.getElementById('btn-close-creds').addEventListener('click', () => {
    root.innerHTML = '';
    loadApplications();
  });
}

// Document initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadIdentity();
    renderSidebarUser();

    // Check if the user is a global admin
    if (!hasGlobalRole()) {
      alert('You are not authorized to view this page.');
      window.location.href = 'dashboard.html';
      return;
    }

    // Sidebar links are static in HTML — no injection needed

    // Set toggle change listeners
    document.getElementById('toggle-board').addEventListener('change', (e) => {
      handleToggleWindow('board', e.target.checked);
    });
    document.getElementById('toggle-member').addEventListener('change', (e) => {
      handleToggleWindow('member', e.target.checked);
    });

    // Filter listeners
    document.getElementById('filter-kind').addEventListener('change', loadApplications);
    document.getElementById('filter-status').addEventListener('change', loadApplications);

    // Initial loads
    await loadWindowStatuses();
    await loadApplications();

  } catch (err) {
    console.error('Initialization failed', err);
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  Session.clear();
  window.location.href = 'login.html';
});
