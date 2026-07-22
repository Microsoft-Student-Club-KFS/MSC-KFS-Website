// A permission scope entry looks like { scopeType, scopeId, roleCode }.
// `target` describes the resource being acted on: any of departmentId,
// unitId, groupId that apply. A scope entry grants access when:
//   - it is global, or
//   - its scopeType/scopeId matches one of the target identifiers.
function scopeAllows(scopes, target = {}) {
  if (!Array.isArray(scopes)) return false;

  return scopes.some((s) => {
    if (s.scopeType === 'global') return true;
    if (s.scopeType === 'department' && target.departmentId && s.scopeId === target.departmentId) return true;
    if (s.scopeType === 'unit' && target.unitId && s.scopeId === target.unitId) return true;
    if (s.scopeType === 'group' && target.groupId && s.scopeId === target.groupId) return true;
    return false;
  });
}

function hasGlobalScope(scopes) {
  return Array.isArray(scopes) && scopes.some((s) => s.scopeType === 'global');
}

module.exports = { scopeAllows, hasGlobalScope };
