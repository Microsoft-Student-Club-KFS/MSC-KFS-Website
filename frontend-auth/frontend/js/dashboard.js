requireAuth();

const SCOPE_LABELS = {
  global: 'Global',
  department: 'Department',
  unit: 'Unit',
  group: 'Group',
};

function initials(fullName) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function renderUser(user) {
  document.getElementById('sidebar-name').textContent = user.full_name;
  document.getElementById('sidebar-email').textContent = user.email;
  document.getElementById('sidebar-avatar').textContent = initials(user.full_name);

  document.getElementById('header-name').textContent = user.full_name.split(' ')[0];

  document.getElementById('info-full-name').textContent = user.full_name;
  document.getElementById('info-email').textContent = user.email;
  document.getElementById('info-username').textContent = user.username;
  document.getElementById('info-status').textContent = user.account_status;
}

function renderRoles(roles) {
  const tbody = document.getElementById('roles-body');
  const emptyState = document.getElementById('roles-empty');
  tbody.innerHTML = '';

  if (!roles.length) {
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  roles.forEach((role) => {
    const row = document.createElement('tr');

    const roleCell = document.createElement('td');
    roleCell.textContent = role.name;

    const scopeCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge ${role.scopeType === 'global' ? 'scope-global' : ''}`;
    badge.textContent = SCOPE_LABELS[role.scopeType] || role.scopeType;
    scopeCell.appendChild(badge);

    const scopeIdCell = document.createElement('td');
    scopeIdCell.className = 'scope-id';
    scopeIdCell.textContent = role.scopeId ? role.scopeId : '—';

    row.appendChild(roleCell);
    row.appendChild(scopeCell);
    row.appendChild(scopeIdCell);
    tbody.appendChild(row);
  });
}

async function loadDashboard() {
  try {
    const data = await apiRequest('/auth/me');
    if (!data) return;
    renderUser(data.user);
    renderRoles(data.roles);
  } catch (err) {
    document.getElementById('roles-body').innerHTML = '';
    document.getElementById('roles-empty').textContent = 'Could not load your data. Try signing in again.';
    document.getElementById('roles-empty').style.display = 'block';
  }
}

document.getElementById('logout-btn').addEventListener('click', () => {
  Session.clear();
  window.location.href = 'index.html';
});

loadDashboard();
