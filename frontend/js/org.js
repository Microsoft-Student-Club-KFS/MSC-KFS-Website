requireAuth();

function initials(fullName) {
  return fullName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function chipHtml(name, roleLabel) {
  return `<span class="chip">${name}${roleLabel ? ` <span class="chip-role">${roleLabel}</span>` : ''}</span>`;
}

function renderSidebarUser() {
  document.getElementById('sidebar-name').textContent = currentUser.full_name;
  document.getElementById('sidebar-email').textContent = currentUser.email;
  document.getElementById('sidebar-avatar').textContent = initials(currentUser.full_name);
}

function renderToolbar() {
  const toolbar = document.getElementById('toolbar');
  toolbar.innerHTML = '';

  if (hasGlobalRole()) {
    const deptBtn = document.createElement('button');
    deptBtn.className = 'btn-secondary';
    deptBtn.textContent = '+ New department';
    deptBtn.addEventListener('click', () => openCreateDepartmentModal(renderDepartments));
    toolbar.appendChild(deptBtn);
  }

  if (canCreateUsers()) {
    const userBtn = document.createElement('button');
    userBtn.className = 'btn-secondary';
    userBtn.textContent = '+ New user';
    userBtn.addEventListener('click', () => openCreateUserModal(() => {}));
    toolbar.appendChild(userBtn);
  }
}

async function renderDepartments() {
  const container = document.getElementById('departments-container');
  container.innerHTML = '<p class="loading-state">Loading departments...</p>';
  try {
    const departments = await fetchDepartments();
    container.innerHTML = departments.length
      ? departments.map(renderDepartmentCard).join('')
      : '<p class="empty-state">No departments yet.</p>';
  } catch (err) {
    container.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}

function renderDepartmentCard(dept) {
  const directorChips = dept.directors.map((d) => chipHtml(d.fullName, 'Director')).join('')
    || '<span class="node-empty">No director assigned</span>';

  return `
    <div class="tree-node">
      <div class="node-card level-1">
        <div class="node-head">
          <div class="node-title-row">
            <button class="node-toggle" data-action="toggle-units" data-dept-id="${dept.id}">▸</button>
            <div>
              <div class="node-title">${dept.name} <span class="node-code">${dept.code}</span></div>
              <div class="node-subtitle">${dept.description || ''}</div>
            </div>
          </div>
          <div class="node-actions">
            ${hasGlobalRole() ? `<button class="btn-small" data-action="assign-director" data-dept-id="${dept.id}" data-dept-name="${dept.name}">+ Director</button>` : ''}
            ${canManageDepartment(dept.id) ? `<button class="btn-small" data-action="add-unit" data-dept-id="${dept.id}" data-dept-name="${dept.name}">+ Track / Section</button>` : ''}
          </div>
        </div>
        <div class="chip-row">${directorChips}</div>
        <div class="node-children" id="units-of-${dept.id}" style="display:none;"></div>
      </div>
    </div>
  `;
}

function renderUnitCard(unit) {
  const leadershipChips = unit.leadership
    .map((l) => chipHtml(l.fullName, ROLE_LABELS[l.position]))
    .join('') || '<span class="node-empty">No lead assigned</span>';

  const canAssign = canAssignAt('unit', unit.id, unit.department_id, unit.id);
  const canManage = canManageUnit(unit.id, unit.department_id);

  return `
    <div class="tree-node">
      <div class="node-card level-2 ${!unit.is_active ? 'node-inactive' : ''}">
        <div class="node-head">
          <div class="node-title-row">
            <button class="node-toggle" data-action="toggle-groups" data-unit-id="${unit.id}">▸</button>
            <div>
              <div class="node-title">${unit.name} <span class="node-code">${unit.code} · ${unit.kind}${!unit.is_active ? ' · inactive' : ''}</span></div>
              <div class="node-subtitle">${unit.description || ''}</div>
            </div>
          </div>
          <div class="node-actions">
            ${canManage ? `<button class="btn-small" data-action="edit-unit" data-unit-id="${unit.id}" data-dept-id="${unit.department_id}" data-unit-name="${unit.name}" data-unit-desc="${unit.description || ''}" data-unit-short="${unit.short_code || ''}" data-unit-whatsapp="${unit.whatsappLink || ''}" data-unit-active="${unit.is_active}">Edit Track</button>` : ''}
            ${canAssign ? `<button class="btn-small" data-action="assign-unit-role" data-unit-id="${unit.id}" data-dept-id="${unit.department_id}" data-unit-name="${unit.name}">+ Lead / Member</button>` : ''}
            ${canManage ? `<button class="btn-small" data-action="add-group" data-unit-id="${unit.id}" data-unit-name="${unit.name}">+ Group</button>` : ''}
          </div>
        </div>
        <div class="chip-row">${leadershipChips}</div>
        <div class="node-children" id="groups-of-${unit.id}" style="display:none;"></div>
      </div>
    </div>
  `;
}

function canExportVcf(groupId, unitId, departmentId) {
  if (hasGlobalRole()) return true;
  return currentRoles.some((r) => {
    if (r.scopeType === 'department' && r.scopeId === departmentId) return true;
    if (r.scopeType === 'unit' && r.scopeId === unitId) return true;
    if (r.scopeType === 'group' && r.scopeId === groupId) return true;
    return false;
  });
}

function renderGroupCard(group) {
  const mentorChips = group.mentors.map((m) => chipHtml(m.fullName, 'Mentor')).join('')
    || '<span class="node-empty">No mentor assigned</span>';

  const canAssign = canAssignAt('group', group.id, group.department_id, group.unit_id);
  const canManage = canAssignAt('unit', null, group.department_id, group.unit_id);
  const memberCountLabel = `${group.active_member_count} active member${group.active_member_count === 1 ? '' : 's'}`;
  const capacityLabel = group.capacity ? ` · capacity ${group.capacity}` : '';
  const canExport = canExportVcf(group.id, group.unit_id, group.department_id);
  const whatsappBadge = group.whatsappLink
    ? `<a href="${group.whatsappLink}" target="_blank" title="WhatsApp Group" style="font-size:12px; color:var(--success); text-decoration:none; margin-left:8px;">📱 WhatsApp</a>`
    : '';

  return `
    <div class="tree-node">
      <div class="node-card level-3">
        <div class="node-head">
          <div class="node-title-row">
            <div>
              <div class="node-title">${group.name} <span class="node-code">${group.code}</span>${whatsappBadge}</div>
              <div class="node-subtitle">${memberCountLabel}${capacityLabel}</div>
            </div>
          </div>
          <div class="node-actions">
            ${canExport ? `<button class="btn-small" data-action="download-vcf" data-group-id="${group.id}">Download contacts (.vcf)</button>` : ''}
            ${canManage ? `<button class="btn-small" data-action="edit-group" data-group-id="${group.id}" data-unit-id="${group.unit_id}" data-group-name="${group.name}" data-group-capacity="${group.capacity || ''}" data-group-whatsapp="${group.whatsappLink || ''}" data-group-active="${group.is_active}">Edit</button>` : ''}
            ${canAssign ? `<button class="btn-small" data-action="assign-group-role" data-group-id="${group.id}" data-unit-id="${group.unit_id}" data-group-name="${group.name}">+ Mentor / Member</button>` : ''}
          </div>
        </div>
        <div class="chip-row">${mentorChips}</div>
      </div>
    </div>
  `;
}

async function toggleUnits(deptId) {
  const container = document.getElementById(`units-of-${deptId}`);
  const isHidden = container.style.display === 'none';

  if (isHidden) {
    if (container.dataset.loaded !== 'true') {
      container.innerHTML = '<p class="loading-state">Loading...</p>';
      try {
        const units = await fetchUnits(deptId);
        container.innerHTML = units.length
          ? units.map(renderUnitCard).join('')
          : '<p class="node-empty">No tracks or sections yet.</p>';
        container.dataset.loaded = 'true';
      } catch (err) {
        container.innerHTML = `<p class="node-empty">${err.message}</p>`;
      }
    }
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}

async function toggleGroups(unitId) {
  const container = document.getElementById(`groups-of-${unitId}`);
  const isHidden = container.style.display === 'none';

  if (isHidden) {
    if (container.dataset.loaded !== 'true') {
      container.innerHTML = '<p class="loading-state">Loading...</p>';
      try {
        const groups = await fetchGroups(unitId);
        container.innerHTML = groups.length
          ? groups.map(renderGroupCard).join('')
          : '<p class="node-empty">No groups yet.</p>';
        container.dataset.loaded = 'true';
      } catch (err) {
        container.innerHTML = `<p class="node-empty">${err.message}</p>`;
      }
    }
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
}

// Reloads a unit's group list the next time it is expanded.
function invalidateGroups(unitId) {
  const container = document.getElementById(`groups-of-${unitId}`);
  if (container) container.dataset.loaded = 'false';
}

function invalidateUnits(deptId) {
  const container = document.getElementById(`units-of-${deptId}`);
  if (container) container.dataset.loaded = 'false';
}

async function forceReloadUnits(deptId) {
  invalidateUnits(deptId);
  const container = document.getElementById(`units-of-${deptId}`);
  container.innerHTML = '<p class="loading-state">Loading...</p>';
  try {
    const units = await fetchUnits(deptId);
    container.innerHTML = units.length ? units.map(renderUnitCard).join('') : '<p class="node-empty">No tracks or sections yet.</p>';
    container.dataset.loaded = 'true';
  } catch (err) {
    container.innerHTML = `<p class="node-empty">${err.message}</p>`;
  }
  container.style.display = 'block';
  const toggle = document.querySelector(`[data-action="toggle-units"][data-dept-id="${deptId}"]`);
  if (toggle) toggle.textContent = '▾';
}

async function forceReloadGroups(unitId) {
  invalidateGroups(unitId);
  const container = document.getElementById(`groups-of-${unitId}`);
  container.innerHTML = '<p class="loading-state">Loading...</p>';
  try {
    const groups = await fetchGroups(unitId);
    container.innerHTML = groups.length ? groups.map(renderGroupCard).join('') : '<p class="node-empty">No groups yet.</p>';
    container.dataset.loaded = 'true';
  } catch (err) {
    container.innerHTML = `<p class="node-empty">${err.message}</p>`;
  }
  container.style.display = 'block';
  const toggle = document.querySelector(`[data-action="toggle-groups"][data-unit-id="${unitId}"]`);
  if (toggle) toggle.textContent = '▾';
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'toggle-units') {
    const isHidden = document.getElementById(`units-of-${btn.dataset.deptId}`).style.display === 'none';
    btn.textContent = isHidden ? '▾' : '▸';
    toggleUnits(btn.dataset.deptId);
  }

  if (action === 'toggle-groups') {
    const isHidden = document.getElementById(`groups-of-${btn.dataset.unitId}`).style.display === 'none';
    btn.textContent = isHidden ? '▾' : '▸';
    toggleGroups(btn.dataset.unitId);
  }

  if (action === 'add-unit') {
    openCreateUnitModal(btn.dataset.deptId, () => forceReloadUnits(btn.dataset.deptId));
  }

  if (action === 'edit-unit') {
    const unit = {
      id: btn.dataset.unitId,
      name: btn.dataset.unitName,
      description: btn.dataset.unitDesc,
      shortCode: btn.dataset.unitShort,
      whatsappLink: btn.dataset.unitWhatsapp || null,
      isActive: btn.dataset.unitActive === 'true',
    };
    openEditUnitModal(unit, () => forceReloadUnits(btn.dataset.deptId));
  }

  if (action === 'add-group') {
    openCreateGroupModal(btn.dataset.unitId, () => forceReloadGroups(btn.dataset.unitId));
  }

  if (action === 'edit-group') {
    const group = {
      id: btn.dataset.groupId,
      name: btn.dataset.groupName,
      capacity: btn.dataset.groupCapacity ? Number(btn.dataset.groupCapacity) : null,
      whatsappLink: btn.dataset.groupWhatsapp || null,
      is_active: btn.dataset.groupActive === 'true',
    };
    openEditGroupModal(group, btn.dataset.unitId, () => forceReloadGroups(btn.dataset.unitId));
  }

  if (action === 'assign-director') {
    openAssignRoleModal(
      { scopeType: 'department', scopeId: btn.dataset.deptId, scopeLabel: btn.dataset.deptName },
      renderDepartments
    );
  }

  if (action === 'assign-unit-role') {
    openAssignRoleModal(
      { scopeType: 'unit', scopeId: btn.dataset.unitId, scopeLabel: btn.dataset.unitName },
      () => forceReloadUnits(btn.dataset.deptId)
    );
  }

  if (action === 'assign-group-role') {
    openAssignRoleModal(
      { scopeType: 'group', scopeId: btn.dataset.groupId, scopeLabel: btn.dataset.groupName },
      () => forceReloadGroups(btn.dataset.unitId)
    );
  }

  if (action === 'download-vcf') {
    const groupId = btn.dataset.groupId;
    try {
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Downloading...';

      const response = await fetch(`${API_BASE_URL}/groups/${groupId}/vcf`, {
        headers: {
          'Authorization': `Bearer ${Session.getToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export contacts');
      }

      const skipped = response.headers.get('X-Skipped-Contacts-Count') || '0';
      const contentDisposition = response.headers.get('Content-Disposition') || '';
      let filename = 'contacts.vcf';
      const matches = contentDisposition.match(/filename="?([^"]+)"?/);
      if (matches && matches[1]) {
        filename = matches[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      btn.textContent = originalText;
      btn.disabled = false;

      if (parseInt(skipped) > 0) {
        alert(`Downloaded contacts. Note: ${skipped} active member(s) with no phone number were skipped.`);
      }
    } catch (err) {
      alert(err.message);
      btn.textContent = 'Download contacts (.vcf)';
      btn.disabled = false;
    }
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  Session.clear();
  window.location.href = 'login.html';
});

(async function init() {
  try {
    await loadIdentity();
    renderSidebarUser();
    renderToolbar();

    // Sidebar: hide admin-only links for non-global users
    if (!hasGlobalRole()) {
      const hide = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
      hide('nav-apps');
      hide('nav-users');
      hide('nav-settings');
    }

    await renderDepartments();
  } catch (err) {
    document.getElementById('departments-container').innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
})();
