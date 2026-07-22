let currentUser = null;
let currentRoles = [];

async function loadIdentity() {
  const data = await apiRequest('/auth/me');
  currentUser = data.user;
  currentRoles = data.roles;
  return data;
}

function hasGlobalRole() {
  return currentRoles.some((r) => r.scopeType === 'global');
}

// Mirrors the server's scope check so buttons only show up when the action
// would actually be allowed. The server re-checks everything regardless;
// this is purely to keep the UI honest, not a security boundary.
function canManageDepartment(departmentId) {
  return hasGlobalRole() || currentRoles.some((r) => r.scopeType === 'department' && r.scopeId === departmentId);
}

function canManageUnit(unitId, departmentId) {
  return hasGlobalRole()
    || currentRoles.some((r) => r.scopeType === 'department' && r.scopeId === departmentId)
    || currentRoles.some((r) => r.scopeType === 'unit' && r.scopeId === unitId);
}

function canAssignAt(scopeType, scopeId, departmentId, unitId) {
  if (hasGlobalRole()) return true;
  if (scopeType === 'department') {
    return currentRoles.some((r) => r.scopeType === 'department' && r.scopeId === scopeId);
  }
  if (scopeType === 'unit') {
    return currentRoles.some((r) => r.scopeType === 'department' && r.scopeId === departmentId)
        || currentRoles.some((r) => r.scopeType === 'unit' && r.scopeId === scopeId);
  }
  if (scopeType === 'group') {
    return currentRoles.some((r) => r.scopeType === 'department' && r.scopeId === departmentId)
        || currentRoles.some((r) => r.scopeType === 'unit' && r.scopeId === unitId);
  }
  return false;
}

function canCreateUsers() {
  return hasGlobalRole();
}

async function fetchDepartments() {
  const data = await apiRequest('/departments');
  return data.departments;
}

async function fetchUnits(departmentId) {
  const data = await apiRequest(`/units?departmentId=${departmentId}`);
  return data.units;
}

async function fetchGroups(unitId) {
  const data = await apiRequest(`/groups?unitId=${unitId}`);
  return data.groups;
}

async function fetchRoleAssignments(scopeType, scopeId) {
  const data = await apiRequest(`/role-assignments?scopeType=${scopeType}&scopeId=${scopeId}`);
  return data.assignments;
}

const ROLE_LABELS = {
  full_access: 'Full Access',
  department_director: 'Director',
  unit_lead: 'Lead',
  unit_vice_lead: 'Vice Lead',
  team_member: 'Team Member',
  mentor: 'Mentor',
  member: 'Member',
};

// Which roles make sense to assign at each scope type, used to populate
// the role dropdown in the assignment modal.
const ROLES_BY_SCOPE = {
  department: ['department_director'],
  unit: ['unit_lead', 'unit_vice_lead', 'team_member'],
  group: ['mentor', 'member'],
};
