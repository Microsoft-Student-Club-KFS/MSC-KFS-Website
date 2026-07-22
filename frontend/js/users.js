/**
 * Microsoft Campus Club - KFS
 * User Management Page Controller
 * File: frontend/js/users.js
 */

let allUsers = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authenticate user session
  if (!Session.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Fetch and render logged-in user profile info
  try {
    await loadIdentity();
    document.getElementById('sidebar-name').textContent = currentUser.full_name;
    document.getElementById('sidebar-email').textContent = currentUser.email;
    document.getElementById('sidebar-avatar').textContent = currentUser.full_name.charAt(0).toUpperCase();

    // Check permissions
    if (!hasGlobalRole()) {
      // Hide admin sections if not authorized
      document.getElementById('nav-apps').style.display = 'none';
      document.getElementById('nav-users').style.display = 'none';
      document.getElementById('nav-settings').style.display = 'none';
      // Redirect since this is admin only
      window.location.href = 'dashboard.html';
      return;
    }
  } catch (err) {
    console.error('Failed to authenticate session', err);
    Session.clear();
    window.location.href = 'login.html';
    return;
  }

  // Logout Handler
  document.getElementById('logout-btn').addEventListener('click', () => {
    Session.clear();
    window.location.href = 'login.html';
  });

  // 3. Load users list
  await loadUsers();

  // Search logic
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    if (!q) {
      renderUsers(allUsers);
    } else {
      const filtered = allUsers.filter(u => 
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
      );
      renderUsers(filtered);
    }
  });

  // New user button
  document.getElementById('btn-create-user').addEventListener('click', () => {
    openCreateUserModal(loadUsers);
  });
});

async function loadUsers() {
  const tbody = document.getElementById('users-body');
  const emptyState = document.getElementById('users-empty');

  try {
    const data = await apiRequest('/users');
    allUsers = data.users || [];
    renderUsers(allUsers);
  } catch (err) {
    tbody.innerHTML = '';
    emptyState.textContent = err.message || 'Failed to load users.';
    emptyState.style.display = 'block';
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('users-body');
  const emptyState = document.getElementById('users-empty');
  tbody.innerHTML = '';

  if (users.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  users.forEach(user => {
    const row = document.createElement('tr');

    // Name & Username
    const nameCell = document.createElement('td');
    nameCell.innerHTML = `<strong>${user.full_name}</strong><br><span style="font-size:12px; color:var(--muted);">${user.username}</span>`;
    row.appendChild(nameCell);

    // Email
    const emailCell = document.createElement('td');
    emailCell.textContent = user.email;
    row.appendChild(emailCell);

    // Phone
    const phoneCell = document.createElement('td');
    phoneCell.textContent = user.phone_number || '—';
    row.appendChild(phoneCell);

    // Type (Member status)
    const typeCell = document.createElement('td');
    let typeLabel = 'Staff';
    if (user.member_status === 'student') typeLabel = 'Student Member';
    else if (user.member_status === 'graduate') typeLabel = 'Graduate Member';
    typeCell.textContent = typeLabel;
    row.appendChild(typeCell);

    // Status
    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `user-badge status-${user.account_status}`;
    badge.textContent = user.account_status;
    statusCell.appendChild(badge);
    row.appendChild(statusCell);

    // Actions
    const actionsCell = document.createElement('td');
    
    // Roles
    const rolesBtn = document.createElement('button');
    rolesBtn.className = 'btn-small';
    rolesBtn.style.marginRight = '8px';
    rolesBtn.style.background = 'var(--primary)';
    rolesBtn.style.color = '#ffffff';
    rolesBtn.textContent = 'Roles';
    rolesBtn.addEventListener('click', () => openUserRolesModal(user, loadUsers));
    actionsCell.appendChild(rolesBtn);

    // Edit
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-small';
    editBtn.style.marginRight = '8px';
    editBtn.style.background = 'var(--amber)';
    editBtn.style.color = '#ffffff';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openEditUserModal(user, loadUsers));
    actionsCell.appendChild(editBtn);

    // Delete
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-small';
    deleteBtn.style.background = 'var(--danger)';
    deleteBtn.style.color = '#ffffff';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to delete user "${user.full_name}"? This action cannot be undone.`)) {
        try {
          await apiRequest(`/users/${user.id}`, { method: 'DELETE' });
          await loadUsers();
        } catch (err) {
          alert(err.message || 'Failed to delete user.');
        }
      }
    });
    actionsCell.appendChild(deleteBtn);

    row.appendChild(actionsCell);
    tbody.appendChild(row);
  });
}
