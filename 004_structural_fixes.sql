-- ============================================================================
-- Microsoft Campus Club - KFS
-- Patch 004: structural fixes
-- File: 004_structural_fixes.sql
-- Run after 003_dangerous_actions.sql
-- ============================================================================
--
-- Fixes three issues found after reviewing the original requirements again:
--
-- 1. department_directors, unit_leadership, and group_mentors duplicated
--    what user_roles already does (assigning a role to a user within a
--    scope). Every assignment had to be written twice and could drift out
--    of sync. These three tables are dropped; user_roles is now the single
--    source of truth for every leadership and mentor assignment:
--      - Department Director -> role 'department_director', scope 'department'
--      - Unit Lead / Vice Lead -> role 'unit_lead' / 'unit_vice_lead', scope 'unit'
--      - Mentor                -> role 'mentor', scope 'group'
--
-- 2. Media and Operation units have people executing work under a Lead who
--    are not learners like TMP track members. Adds a 'team_member' role,
--    scoped to a unit.
--
-- 3. Evaluations were tied only to `members` (i.e. learners), but the
--    original requirement is that anyone can evaluate the people below
--    them (a Director evaluates a Lead, a Lead evaluates a Mentor or Team
--    Member, a Mentor evaluates a learner). evaluations now targets any
--    user, with a context (department / unit / group) instead of being
--    hard-wired to a group.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Drop the duplicated assignment tables
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS department_directors CASCADE;
DROP TABLE IF EXISTS unit_leadership CASCADE;
DROP TABLE IF EXISTS group_mentors CASCADE;

-- ----------------------------------------------------------------------------
-- 2. New role: team_member
-- ----------------------------------------------------------------------------

INSERT INTO roles (code, name, description) VALUES
    ('team_member', 'Team Member', 'Executes work within a unit under its Lead (e.g. a Media or Operation contributor). Scope: unit.');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'team_member' AND p.code IN (
    'unit.view',
    'group.view',
    'member.view.own',
    'evaluation.view.own',
    'attendance.view.own'
);

-- department_director can now also evaluate the people in their scope
-- (e.g. Unit Leads), not just view existing evaluations.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'department_director' AND p.code = 'evaluation.create.scope'
AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- ----------------------------------------------------------------------------
-- 3. Generalize evaluations to target any user, with a flexible context
-- ----------------------------------------------------------------------------

ALTER TABLE evaluations DROP CONSTRAINT evaluations_member_id_fkey;
ALTER TABLE evaluations RENAME COLUMN member_id TO evaluatee_id;
ALTER TABLE evaluations ADD CONSTRAINT evaluations_evaluatee_id_fkey
    FOREIGN KEY (evaluatee_id) REFERENCES users(id) ON DELETE CASCADE;

-- evaluatee_id previously pointed to members.id; existing rows (if any)
-- must be re-pointed to the corresponding users.id before this patch is
-- run against a database that already has evaluation data. On a fresh
-- database (no evaluations yet) this is a no-op.
UPDATE evaluations e
SET evaluatee_id = m.user_id
FROM members m
WHERE e.evaluatee_id = m.id;

ALTER TABLE evaluations DROP CONSTRAINT evaluations_group_id_fkey;
ALTER TABLE evaluations DROP COLUMN group_id;

ALTER TABLE evaluations ADD COLUMN context_type role_scope_type NOT NULL DEFAULT 'group';
ALTER TABLE evaluations ALTER COLUMN context_type DROP DEFAULT;
ALTER TABLE evaluations ADD COLUMN context_id UUID;
ALTER TABLE evaluations ALTER COLUMN context_id SET NOT NULL;

ALTER TABLE evaluations ADD CONSTRAINT chk_evaluation_context_not_global
    CHECK (context_type IN ('department', 'unit', 'group'));

DROP INDEX IF EXISTS idx_evaluations_member;
DROP INDEX IF EXISTS idx_evaluations_group;
CREATE INDEX idx_evaluations_evaluatee ON evaluations(evaluatee_id);
CREATE INDEX idx_evaluations_context ON evaluations(context_type, context_id);
