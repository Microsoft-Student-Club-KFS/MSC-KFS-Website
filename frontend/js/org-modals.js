const modalRoot = document.getElementById('modal-root');

function closeModal() {
  modalRoot.innerHTML = '';
}

function openModal({ title, bodyHtml, onMount, onSubmit, submitLabel = 'Save' }) {
  modalRoot.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal">
        <h3>${title}</h3>
        <div class="modal-error" id="modal-error"></div>
        <form id="modal-form">
          ${bodyHtml}
          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="modal-cancel">Cancel</button>
            <button type="submit" class="btn-primary" id="modal-submit" style="width:auto;">${submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  if (onMount) onMount();

  const form = document.getElementById('modal-form');
  const errorBox = document.getElementById('modal-error');
  const submitBtn = document.getElementById('modal-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.classList.remove('visible');
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';

    try {
      await onSubmit(new FormData(form));
      closeModal();
    } catch (err) {
      errorBox.textContent = err.message || 'Something went wrong';
      errorBox.classList.add('visible');
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

// ---------------------------------------------------------------------- //
// Create Department
// ---------------------------------------------------------------------- //

function openCreateDepartmentModal(onDone) {
  openModal({
    title: 'New department',
    bodyHtml: `
      <div class="field"><label>Code</label><input name="code" placeholder="e.g. tmp" required></div>
      <div class="field"><label>Name</label><input name="name" placeholder="e.g. Technical Mentorship Program" required></div>
      <div class="field"><label>Description</label><input name="description" placeholder="Optional"></div>
      <div class="field"><label>WhatsApp Group Link <span style="font-weight:400; color:var(--muted);">(optional)</span></label><input name="whatsappLink" type="url" placeholder="https://chat.whatsapp.com/..."></div>
    `,
    onSubmit: async (formData) => {
      await apiRequest('/departments', {
        method: 'POST',
        body: JSON.stringify({
          code: formData.get('code').trim(),
          name: formData.get('name').trim(),
          description: formData.get('description').trim() || null,
          whatsappLink: formData.get('whatsappLink').trim() || null,
        }),
      });
      onDone();
    },
  });
}

// ---------------------------------------------------------------------- //
// Create Unit
// ---------------------------------------------------------------------- //

function openCreateUnitModal(departmentId, onDone) {
  openModal({
    title: 'New track / section',
    bodyHtml: `
      <div class="field"><label>Code</label><input name="code" placeholder="e.g. data_science" required></div>
      <div class="field"><label>Name</label><input name="name" placeholder="e.g. Data Science" required></div>
      <div class="field"><label>Short Code (VCF Prefix)</label><input name="shortCode" placeholder="e.g. ds" maxlength="10"></div>
      <div class="field">
        <label>Kind</label>
        <select name="kind" required>
          <option value="track">Track</option>
          <option value="section">Section</option>
        </select>
      </div>
      <div class="field"><label>Description</label><input name="description" placeholder="Optional"></div>
      <div class="field"><label>WhatsApp Group Link <span style="font-weight:400; color:var(--muted);">(optional)</span></label><input name="whatsappLink" type="url" placeholder="https://chat.whatsapp.com/..."></div>
    `,
    onSubmit: async (formData) => {
      await apiRequest('/units', {
        method: 'POST',
        body: JSON.stringify({
          departmentId,
          code: formData.get('code').trim(),
          name: formData.get('name').trim(),
          shortCode: formData.get('shortCode').trim() || null,
          kind: formData.get('kind'),
          description: formData.get('description').trim() || null,
          whatsappLink: formData.get('whatsappLink').trim() || null,
        }),
      });
      onDone();
    },
  });
}

function openEditUnitModal(unit, onDone) {
  openModal({
    title: 'Edit track / section',
    bodyHtml: `
      <div class="field"><label>Name</label><input name="name" value="${unit.name}" required></div>
      <div class="field"><label>Short Code (VCF Prefix)</label><input name="shortCode" value="${unit.shortCode || ''}" placeholder="e.g. ds" maxlength="10"></div>
      <div class="field"><label>Description</label><input name="description" value="${unit.description || ''}" placeholder="Optional"></div>
      <div class="field"><label>WhatsApp Group Link <span style="font-weight:400; color:var(--muted);">(optional)</span></label><input name="whatsappLink" type="url" value="${unit.whatsappLink || ''}" placeholder="https://chat.whatsapp.com/..."></div>
      <div class="field">
        <label>Status</label>
        <select name="isActive">
          <option value="true" ${unit.isActive ? 'selected' : ''}>Active</option>
          <option value="false" ${!unit.isActive ? 'selected' : ''}>Inactive / Deactivated</option>
        </select>
      </div>
      <div style="margin-top: 20px; border-top: 1px solid var(--line); padding-top: 20px;">
        <button type="button" class="btn-primary" id="btn-delete-unit" style="background: var(--danger); width: 100%;">Delete Track / Section</button>
      </div>
    `,
    onMount: () => {
      document.getElementById('btn-delete-unit').addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete "${unit.name}"? This will delete all groups and enrollments under it. This action cannot be undone.`)) {
          try {
            await apiRequest(`/units/${unit.id}`, {
              method: 'DELETE'
            });
            closeModal();
            onDone();
          } catch (err) {
            const errDiv = document.getElementById('modal-error');
            if (errDiv) {
              errDiv.textContent = err.message || 'Failed to delete track.';
              errDiv.classList.add('visible');
            }
          }
        }
      });
    },
    onSubmit: async (formData) => {
      await apiRequest(`/units/${unit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: formData.get('name').trim(),
          shortCode: formData.get('shortCode').trim() || null,
          description: formData.get('description').trim() || null,
          whatsappLink: formData.get('whatsappLink').trim() || null,
          isActive: formData.get('isActive') === 'true',
        }),
      });
      onDone();
    },
  });
}

// ---------------------------------------------------------------------- //
// Create Group
// ---------------------------------------------------------------------- //

function openCreateGroupModal(unitId, onDone) {
  openModal({
    title: 'New group',
    bodyHtml: `
      <div class="field"><label>Code</label><input name="code" placeholder="e.g. g1" required></div>
      <div class="field"><label>Name</label><input name="name" placeholder="e.g. Group 1" required></div>
      <div class="field"><label>Capacity</label><input name="capacity" type="number" min="1" placeholder="Optional"></div>
      <div class="field"><label>WhatsApp Group Link <span style="font-weight:400; color:var(--muted);">(optional)</span></label><input name="whatsappLink" type="url" placeholder="https://chat.whatsapp.com/..."></div>
    `,
    onSubmit: async (formData) => {
      const capacity = formData.get('capacity');
      await apiRequest('/groups', {
        method: 'POST',
        body: JSON.stringify({
          unitId,
          code: formData.get('code').trim(),
          name: formData.get('name').trim(),
          capacity: capacity ? Number(capacity) : null,
          whatsappLink: formData.get('whatsappLink').trim() || null,
        }),
      });
      onDone();
    },
  });
}

// ---------------------------------------------------------------------- //
// Assign role (Director / Lead / Vice Lead / Team Member / Mentor / Member)
// ---------------------------------------------------------------------- //

function openEditGroupModal(group, unitId, onDone) {
  openModal({
    title: 'Edit group',
    bodyHtml: `
      <div class="field"><label>Name</label><input name="name" value="${group.name}" required></div>
      <div class="field"><label>Capacity <span style="font-weight:400; color:var(--muted);">(blank = unlimited)</span></label><input name="capacity" type="number" min="1" value="${group.capacity || ''}"></div>
      <div class="field"><label>WhatsApp Group Link <span style="font-weight:400; color:var(--muted);">(optional)</span></label><input name="whatsappLink" type="url" value="${group.whatsappLink || ''}" placeholder="https://chat.whatsapp.com/..."></div>
      <div class="field">
        <label>Status</label>
        <select name="isActive">
          <option value="true" ${group.is_active ? 'selected' : ''}>Active</option>
          <option value="false" ${!group.is_active ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
    `,
    onSubmit: async (formData) => {
      const capacity = formData.get('capacity');
      await apiRequest(`/groups/${group.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: formData.get('name').trim(),
          capacity: capacity ? Number(capacity) : null,
          whatsappLink: formData.get('whatsappLink').trim() || null,
          isActive: formData.get('isActive') === 'true',
        }),
      });
      onDone();
    },
  });
}

function openAssignRoleModal({ scopeType, scopeId, scopeLabel }, onDone) {
  const roleOptions = ROLES_BY_SCOPE[scopeType]
    .map((code) => `<option value="${code}">${ROLE_LABELS[code]}</option>`)
    .join('');

  let selectedUserId = null;

  openModal({
    title: `Assign a role — ${scopeLabel}`,
    bodyHtml: `
      <div class="field">
        <label>Role</label>
        <select name="roleCode" required>${roleOptions}</select>
      </div>
      <div class="field">
        <label>Person</label>
        <input name="userSearch" placeholder="Search by name, email, or username" autocomplete="off">
        <div class="search-result-list" id="search-results"></div>
        <p class="hint-text" id="selected-user-hint"></p>
      </div>
    `,
    onMount: () => {
      const searchInput = document.querySelector('input[name="userSearch"]');
      const resultsBox = document.getElementById('search-results');
      const hint = document.getElementById('selected-user-hint');
      let debounceTimer = null;

      searchInput.addEventListener('input', () => {
        selectedUserId = null;
        hint.textContent = '';
        clearTimeout(debounceTimer);
        const q = searchInput.value.trim();
        debounceTimer = setTimeout(async () => {
          try {
            const data = await apiRequest(`/users/search?q=${encodeURIComponent(q)}`);
            resultsBox.innerHTML = data.users.map((u) => `
              <div class="search-result-item" data-user-id="${u.id}" data-user-name="${u.full_name}">
                ${u.full_name} — ${u.email}
              </div>
            `).join('') || '<div class="search-result-item">No matches</div>';
          } catch (err) {
            resultsBox.innerHTML = `<div class="search-result-item">${err.message}</div>`;
          }
        }, 250);
      });

      resultsBox.addEventListener('click', (e) => {
        const item = e.target.closest('[data-user-id]');
        if (!item) return;
        selectedUserId = item.dataset.userId;
        hint.textContent = `Selected: ${item.dataset.userName}`;
        resultsBox.innerHTML = '';
        searchInput.value = item.dataset.userName;
      });
    },
    onSubmit: async (formData) => {
      if (!selectedUserId) {
        throw new Error('Search for and select a person first');
      }
      await apiRequest('/role-assignments', {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedUserId,
          roleCode: formData.get('roleCode'),
          scopeType,
          scopeId,
        }),
      });
      onDone();
    },
  });
}

// ---------------------------------------------------------------------- //
// Create user
// ---------------------------------------------------------------------- //

function openCreateUserModal(onDone) {
  openModal({
    title: 'New user account',
    bodyHtml: `
      <div class="field"><label>Full name (English only)</label><input name="fullName" required></div>
      <div class="field"><label>Email</label><input name="email" type="email" required></div>
      <div class="field"><label>Phone number</label><input name="phoneNumber" placeholder="e.g. +201234567890"></div>
      <div class="field"><label>Username</label><input name="username" required></div>
      <div class="field"><label>Temporary password</label><input name="password" type="text" minlength="8" required></div>
      <div class="field">
        <label>Status</label>
        <select name="memberStatus">
          <option value="">Board / staff only</option>
          <option value="student">Student</option>
          <option value="graduate">Graduate</option>
        </select>
      </div>
      <div class="field" id="university-field" style="display:none;"><label>University</label><input name="universityName"></div>
      <div class="field" id="year-field" style="display:none;"><label>Year</label><input name="universityYear"></div>
      <div class="field" id="company-field" style="display:none;"><label>Company</label><input name="companyName"></div>
      <div class="field" id="job-field" style="display:none;"><label>Job title</label><input name="jobTitle"></div>
      <div class="field"><label>LinkedIn</label><input name="linkedinUrl" placeholder="https://linkedin.com/in/..." required></div>
      <div class="field"><label>GitHub</label><input name="githubUrl" placeholder="Optional"></div>
    `,
    onMount: () => {
      const select = document.querySelector('select[name="memberStatus"]');
      const uniField = document.getElementById('university-field');
      const yearField = document.getElementById('year-field');
      const companyField = document.getElementById('company-field');
      const jobField = document.getElementById('job-field');

      select.addEventListener('change', () => {
        const isStudent = select.value === 'student';
        const isGraduate = select.value === 'graduate';
        uniField.style.display = isStudent ? 'block' : 'none';
        yearField.style.display = isStudent ? 'block' : 'none';
        companyField.style.display = isGraduate ? 'block' : 'none';
        jobField.style.display = isGraduate ? 'block' : 'none';
      });
    },
    onSubmit: async (formData) => {
      const memberStatus = formData.get('memberStatus') || null;
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: formData.get('fullName').trim(),
          email: formData.get('email').trim(),
          phoneNumber: formData.get('phoneNumber').trim() || null,
          username: formData.get('username').trim(),
          password: formData.get('password'),
          memberStatus,
          universityName: formData.get('universityName').trim() || null,
          universityYear: formData.get('universityYear').trim() || null,
          companyName: formData.get('companyName').trim() || null,
          jobTitle: formData.get('jobTitle').trim() || null,
          linkedinUrl: formData.get('linkedinUrl').trim() || null,
          githubUrl: formData.get('githubUrl').trim() || null,
        }),
      });
      onDone();
    },
  });
}

function openEditUserModal(user, onDone) {
  openModal({
    title: 'Edit user account',
    bodyHtml: `
      <div class="field"><label>Full name (English only)</label><input name="fullName" value="${user.full_name}" required></div>
      <div class="field"><label>Email</label><input name="email" type="email" value="${user.email}" required></div>
      <div class="field"><label>Phone number</label><input name="phoneNumber" value="${user.phone_number || ''}" placeholder="e.g. +201234567890"></div>
      <div class="field">
        <label>Status</label>
        <select name="memberStatus">
          <option value="" ${!user.member_status ? 'selected' : ''}>Board / staff only</option>
          <option value="student" ${user.member_status === 'student' ? 'selected' : ''}>Student</option>
          <option value="graduate" ${user.member_status === 'graduate' ? 'selected' : ''}>Graduate</option>
        </select>
      </div>
      <div class="field" id="university-field-edit" style="display:${user.member_status === 'student' ? 'block' : 'none'};"><label>University</label><input name="universityName" value="${user.university_name || ''}"></div>
      <div class="field" id="year-field-edit" style="display:${user.member_status === 'student' ? 'block' : 'none'};"><label>Year</label><input name="universityYear" value="${user.university_year || ''}"></div>
      <div class="field" id="company-field-edit" style="display:${user.member_status === 'graduate' ? 'block' : 'none'};"><label>Company</label><input name="companyName" value="${user.company_name || ''}"></div>
      <div class="field" id="job-field-edit" style="display:${user.member_status === 'graduate' ? 'block' : 'none'};"><label>Job title</label><input name="jobTitle" value="${user.job_title || ''}"></div>
      <div class="field">
        <label>Account Status</label>
        <select name="accountStatus">
          <option value="active" ${user.account_status === 'active' ? 'selected' : ''}>Active</option>
          <option value="suspended" ${user.account_status === 'suspended' ? 'selected' : ''}>Suspended</option>
          <option value="disabled" ${user.account_status === 'disabled' ? 'selected' : ''}>Disabled</option>
        </select>
      </div>
      <div class="field"><label>LinkedIn</label><input name="linkedinUrl" value="${user.linkedin_url || ''}" placeholder="https://linkedin.com/in/..." required></div>
      <div class="field"><label>GitHub</label><input name="githubUrl" value="${user.github_url || ''}" placeholder="Optional"></div>
    `,
    onMount: () => {
      const select = document.querySelector('select[name="memberStatus"]');
      const uniField = document.getElementById('university-field-edit');
      const yearField = document.getElementById('year-field-edit');
      const companyField = document.getElementById('company-field-edit');
      const jobField = document.getElementById('job-field-edit');

      select.addEventListener('change', () => {
        const isStudent = select.value === 'student';
        const isGraduate = select.value === 'graduate';
        uniField.style.display = isStudent ? 'block' : 'none';
        yearField.style.display = isStudent ? 'block' : 'none';
        companyField.style.display = isGraduate ? 'block' : 'none';
        jobField.style.display = isGraduate ? 'block' : 'none';
      });
    },
    onSubmit: async (formData) => {
      const memberStatus = formData.get('memberStatus') || null;
      await apiRequest(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: formData.get('fullName').trim(),
          email: formData.get('email').trim(),
          phoneNumber: formData.get('phoneNumber').trim() || null,
          memberStatus,
          universityName: formData.get('universityName').trim() || null,
          universityYear: formData.get('universityYear').trim() || null,
          companyName: formData.get('companyName').trim() || null,
          jobTitle: formData.get('jobTitle').trim() || null,
          accountStatus: formData.get('accountStatus'),
          linkedinUrl: formData.get('linkedinUrl').trim() || null,
          githubUrl: formData.get('githubUrl').trim() || null,
        }),
      });
      onDone();
    },
  });
}

async function openUserRolesModal(user, onDone) {
  const root = document.getElementById('modal-root');
  
  // Render Modal Shell
  root.innerHTML = `
    <div class="modal-overlay" id="roles-modal-overlay">
      <div class="modal" style="max-width: 600px; padding: 26px;">
        <h3 style="margin-top:0; font-family:var(--font-display); font-size:18px;">Manage Roles: ${user.full_name}</h3>
        <p style="margin:0 0 16px; font-size:13px; color:var(--muted);">View and manage role assignments and access privileges for this account.</p>
        
        <div class="modal-error" id="roles-modal-error" style="display:none; margin-bottom:12px;"></div>
        
        <h4 style="margin: 0 0 10px; font-size:14px; font-weight:700;">Active Roles</h4>
        <div style="max-height: 180px; overflow-y: auto; margin-bottom: 24px; border: 1px solid var(--line); border-radius: var(--radius);">
          <table class="roles-table" style="margin: 0; width: 100%;">
            <thead>
              <tr style="background: var(--page);">
                <th style="padding: 8px 12px; font-size:12px;">Role</th>
                <th style="padding: 8px 12px; font-size:12px;">Scope</th>
                <th style="padding: 8px 12px; font-size:12px; text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody id="user-roles-list-body">
              <tr><td colspan="3" style="text-align:center; padding:12px; color:var(--muted); font-size:13px;">Loading active roles...</td></tr>
            </tbody>
          </table>
        </div>

        <h4 style="margin: 0 0 12px; font-size:14px; font-weight:700; border-top:1px solid var(--line); padding-top:20px;">Assign New Role</h4>
        <form id="add-role-form" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div class="field" style="margin:0;">
              <label style="font-size:12px; margin-bottom:4px;">Scope Level</label>
              <select id="new-role-scope-type" required>
                <option value="global">Global</option>
                <option value="department">Department</option>
                <option value="unit">Track / Section</option>
                <option value="group">Group</option>
              </select>
            </div>
            <div class="field" style="margin:0; display:none;" id="new-role-scope-id-container">
              <label style="font-size:12px; margin-bottom:4px;" id="new-role-scope-id-label">Target</label>
              <select id="new-role-scope-id"></select>
            </div>
          </div>
          
          <div class="field" style="margin:0;">
            <label style="font-size:12px; margin-bottom:4px;">Assign Role</label>
            <select id="new-role-code" required>
              <option value="full_access">Full Access (Super Admin)</option>
            </select>
          </div>
          
          <div style="margin-top:15px; display:flex; justify-content:flex-end; gap:10px;">
            <button type="button" class="btn-secondary" id="btn-close-roles" style="width:auto; padding:8px 16px;">Done</button>
            <button type="submit" class="btn-primary" style="width:auto; padding:8px 24px;">Assign Role</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Variables for dynamic selectors
  const scopeTypeSelect = document.getElementById('new-role-scope-type');
  const scopeIdContainer = document.getElementById('new-role-scope-id-container');
  const scopeIdLabel = document.getElementById('new-role-scope-id-label');
  const scopeIdSelect = document.getElementById('new-role-scope-id');
  const roleCodeSelect = document.getElementById('new-role-code');
  const addForm = document.getElementById('add-role-form');
  const errBox = document.getElementById('roles-modal-error');

  // Close handlers
  document.getElementById('roles-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'roles-modal-overlay') root.innerHTML = '';
  });
  document.getElementById('btn-close-roles').addEventListener('click', () => {
    root.innerHTML = '';
    if (onDone) onDone();
  });

  // Cached list values
  let deptsList = [];
  let unitsList = [];
  let groupsList = [];

  // Function to load and render user's current roles
  async function reloadUserRoles() {
    const tbody = document.getElementById('user-roles-list-body');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:12px; color:var(--muted); font-size:13px;">Loading...</td></tr>';
    
    try {
      const data = await apiRequest(`/users/${user.id}/roles`);
      tbody.innerHTML = '';
      if (data.roles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:12px; color:var(--muted); font-size:13px;">No roles assigned yet.</td></tr>';
        return;
      }
      
      data.roles.forEach((r) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td style="padding: 8px 12px; font-size:13px; font-weight:600;">${ROLE_LABELS[r.roleCode] || r.roleName}</td>
          <td style="padding: 8px 12px; font-size:13px; color:var(--muted);">${r.scopeType.toUpperCase()} : ${r.scopeName || 'Global'}</td>
          <td style="padding: 8px 12px; text-align:right;">
            <button class="btn-small btn-revoke" data-assignment-id="${r.id}" style="background:var(--danger); color:#fff; border:none; padding:4px 8px; font-size:11px; margin:0;">Revoke</button>
          </td>
        `;
        tbody.appendChild(row);
      });
      
      // Wire revoke buttons
      tbody.querySelectorAll('.btn-revoke').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const assignmentId = btn.dataset.assignmentId;
          errBox.style.display = 'none';
          try {
            await apiRequest(`/role-assignments/${assignmentId}`, { method: 'DELETE' });
            reloadUserRoles();
          } catch (err) {
            errBox.textContent = err.message || 'Failed to revoke role.';
            errBox.style.display = 'block';
          }
        });
      });
      
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:12px; color:var(--danger); font-size:13px;">${err.message}</td></tr>`;
    }
  }

  // Handle scope level selection changes
  scopeTypeSelect.addEventListener('change', async () => {
    const scopeType = scopeTypeSelect.value;
    errBox.style.display = 'none';
    
    // Default resets
    scopeIdContainer.style.display = 'none';
    scopeIdSelect.required = false;
    scopeIdSelect.innerHTML = '';
    
    if (scopeType === 'global') {
      roleCodeSelect.innerHTML = `<option value="full_access">Full Access (Super Admin)</option>`;
    } 
    else if (scopeType === 'department') {
      scopeIdLabel.textContent = 'Department';
      scopeIdContainer.style.display = 'block';
      scopeIdSelect.required = true;
      roleCodeSelect.innerHTML = `<option value="department_director">Director</option>`;
      
      try {
        if (deptsList.length === 0) {
          const res = await apiRequest('/departments');
          deptsList = res.departments;
        }
        scopeIdSelect.innerHTML = deptsList.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
      } catch (err) {
        errBox.textContent = 'Failed to load departments: ' + err.message;
        errBox.style.display = 'block';
      }
    } 
    else if (scopeType === 'unit') {
      scopeIdLabel.textContent = 'Track / Section';
      scopeIdContainer.style.display = 'block';
      scopeIdSelect.required = true;
      roleCodeSelect.innerHTML = `
        <option value="unit_lead">Lead</option>
        <option value="unit_vice_lead">Vice Lead</option>
        <option value="team_member">Team Member</option>
      `;
      
      try {
        if (unitsList.length === 0) {
          const res = await apiRequest('/units');
          unitsList = res.units;
        }
        scopeIdSelect.innerHTML = unitsList.map(u => `<option value="${u.id}">${u.name} (${u.code})</option>`).join('');
      } catch (err) {
        errBox.textContent = 'Failed to load units: ' + err.message;
        errBox.style.display = 'block';
      }
    } 
    else if (scopeType === 'group') {
      scopeIdLabel.textContent = 'Group';
      scopeIdContainer.style.display = 'block';
      scopeIdSelect.required = true;
      roleCodeSelect.innerHTML = `
        <option value="mentor">Mentor</option>
        <option value="member">Member</option>
      `;
      
      try {
        if (groupsList.length === 0) {
          const res = await apiRequest('/groups');
          groupsList = res.groups;
        }
        scopeIdSelect.innerHTML = groupsList.map(g => `<option value="${g.id}">${g.unit_name} - ${g.name} (${g.code})</option>`).join('');
      } catch (err) {
        errBox.textContent = 'Failed to load groups: ' + err.message;
        errBox.style.display = 'block';
      }
    }
  });

  // Handle Form Submit to assign new role
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.style.display = 'none';
    
    const scopeType = scopeTypeSelect.value;
    const scopeId = scopeIdSelect.value || null;
    const roleCode = roleCodeSelect.value;
    
    try {
      await apiRequest('/role-assignments', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          roleCode,
          scopeType,
          scopeId
        })
      });
      
      // Reload roles list and reset form values
      reloadUserRoles();
    } catch (err) {
      errBox.textContent = err.message || 'Failed to assign role.';
      errBox.style.display = 'block';
    }
  });

  // Initial load
  await reloadUserRoles();
}
