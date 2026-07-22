-- ============================================================================
-- Microsoft Campus Club - KFS
-- Initial Seed Data
-- File: 002_seed.sql
-- Run after 001_schema.sql
-- ============================================================================
--
-- Contents
-- ----------------------------------------------------------------------------
-- 1. Permissions        - granular capabilities checked by the application
-- 2. Roles              - named roles referencing groups of permissions
-- 3. Role -> Permission mapping
-- 4. Departments         - TMP, Media, Operation
-- 5. Starting Units       - editable afterwards through the application, not
--                           a fixed list. Provided here only as a starting point.
-- 6. First Admin account - holds the full_access role at global scope
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PERMISSIONS
-- ----------------------------------------------------------------------------

INSERT INTO permissions (code, description) VALUES
    ('user.manage.all',            'Create, update, or deactivate any user account in the system'),
    ('user.view.all',              'View any user profile in the system'),
    ('user.view.scope',            'View user profiles within the assigned scope only'),

    ('department.manage',          'Create, update, or deactivate departments'),
    ('department.view',            'View department details'),

    ('unit.manage.all',            'Create, update, or deactivate any unit in any department'),
    ('unit.manage.scope',          'Create, update, or deactivate units within the assigned department'),
    ('unit.view',                  'View unit details'),

    ('group.manage.scope',         'Create, update, or deactivate groups within the assigned unit'),
    ('group.view',                 'View group details'),

    ('leadership.assign',          'Assign or remove Lead / Vice Lead of a unit'),
    ('mentor.assign',              'Assign or remove mentors of a group'),

    ('member.manage.scope',        'Add, update, or remove members within the assigned scope'),
    ('member.view.scope',          'View members within the assigned scope'),
    ('member.view.own',            'View own member profile only'),

    ('enrollment.manage.scope',    'Enroll or remove members from groups within the assigned scope'),

    ('evaluation.create.scope',    'Create evaluations for members within the assigned scope'),
    ('evaluation.view.scope',      'View evaluations within the assigned scope'),
    ('evaluation.view.own',        'View own evaluations only'),

    ('attendance.record.scope',    'Record attendance for members within the assigned scope'),
    ('attendance.view.scope',      'View attendance within the assigned scope'),
    ('attendance.view.own',        'View own attendance only'),

    ('role.assign.all',            'Assign any role at any scope'),
    ('role.assign.scope',          'Assign roles within the assigned scope only'),
    ('role.view',                  'View role assignments');

-- ----------------------------------------------------------------------------
-- 2. ROLES
-- ----------------------------------------------------------------------------

INSERT INTO roles (code, name, description) VALUES
    ('full_access',           'Full Access',              'Unrestricted access to the entire system. Typically held by the President and Vice President.'),
    ('department_director',   'Department Director',      'Manages a single department: its units, leadership assignments, and members.'),
    ('unit_lead',             'Unit Lead',                'Manages a single unit (track or section): its groups, mentors, and members.'),
    ('unit_vice_lead',        'Unit Vice Lead',           'Supports the Unit Lead. Same operational access, without role-assignment rights.'),
    ('mentor',                'Mentor',                   'Delivers content to and evaluates the members of an assigned group.'),
    ('member',                'Member',                   'Student or graduate enrolled in a group. Read-only access to own data.');

-- ----------------------------------------------------------------------------
-- 3. ROLE -> PERMISSION MAPPING
-- ----------------------------------------------------------------------------

-- full_access: every permission
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'full_access';

-- department_director
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'department_director' AND p.code IN (
    'department.view',
    'unit.manage.scope', 'unit.view',
    'group.manage.scope', 'group.view',
    'leadership.assign', 'mentor.assign',
    'member.manage.scope', 'member.view.scope',
    'enrollment.manage.scope',
    'evaluation.view.scope',
    'attendance.view.scope',
    'role.assign.scope', 'role.view'
);

-- unit_lead
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'unit_lead' AND p.code IN (
    'unit.view',
    'group.manage.scope', 'group.view',
    'mentor.assign',
    'member.manage.scope', 'member.view.scope',
    'enrollment.manage.scope',
    'evaluation.create.scope', 'evaluation.view.scope',
    'attendance.record.scope', 'attendance.view.scope',
    'role.assign.scope', 'role.view'
);

-- unit_vice_lead: same as unit_lead, without role assignment rights
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'unit_vice_lead' AND p.code IN (
    'unit.view',
    'group.manage.scope', 'group.view',
    'member.manage.scope', 'member.view.scope',
    'enrollment.manage.scope',
    'evaluation.create.scope', 'evaluation.view.scope',
    'attendance.record.scope', 'attendance.view.scope',
    'role.view'
);

-- mentor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'mentor' AND p.code IN (
    'group.view',
    'member.view.scope',
    'evaluation.create.scope', 'evaluation.view.scope',
    'attendance.record.scope', 'attendance.view.scope'
);

-- member
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'member' AND p.code IN (
    'member.view.own',
    'evaluation.view.own',
    'attendance.view.own'
);

-- ----------------------------------------------------------------------------
-- 4. DEPARTMENTS
-- ----------------------------------------------------------------------------

INSERT INTO departments (code, name, description) VALUES
    ('tmp',       'Technical Mentorship Program', 'Runs the technical tracks and mentorship groups.'),
    ('media',     'Media',                        'Handles marketing, graphics, and content production.'),
    ('operation', 'Operation',                     'Handles PR, FR, HR, and logistics.');

-- ----------------------------------------------------------------------------
-- 5. STARTING UNITS
-- These rows are only a starting point and can be renamed, removed, or
-- added to at any point through the application.
-- ----------------------------------------------------------------------------

INSERT INTO units (department_id, code, name, kind, description)
SELECT id, 'data_science', 'Data Science', 'track', 'Data Science learning track.'
FROM departments WHERE code = 'tmp';

INSERT INTO units (department_id, code, name, kind, description)
SELECT id, 'analysis', 'Analysis', 'track', 'Data Analysis learning track.'
FROM departments WHERE code = 'tmp';

INSERT INTO units (department_id, code, name, kind, description)
SELECT id, 'engineering', 'Engineering', 'track', 'Software Engineering learning track.'
FROM departments WHERE code = 'tmp';

INSERT INTO units (department_id, code, name, kind, description)
SELECT id, 'marketing', 'Marketing', 'section', 'Marketing section of Media.'
FROM departments WHERE code = 'media';

INSERT INTO units (department_id, code, name, kind, description)
SELECT id, 'graphics', 'Graphics', 'section', 'Graphic design section of Media.'
FROM departments WHERE code = 'media';

INSERT INTO units (department_id, code, name, kind, description)
SELECT id, 'pr', 'Public Relations', 'section', 'PR section of Operation.'
FROM departments WHERE code = 'operation';

INSERT INTO units (department_id, code, name, kind, description)
SELECT id, 'fr', 'Fundraising', 'section', 'FR section of Operation.'
FROM departments WHERE code = 'operation';

INSERT INTO units (department_id, code, name, kind, description)
SELECT id, 'hr', 'Human Resources', 'section', 'HR section of Operation.'
FROM departments WHERE code = 'operation';

INSERT INTO units (department_id, code, name, kind, description)
SELECT id, 'logistics', 'Logistics', 'section', 'Logistics section of Operation.'
FROM departments WHERE code = 'operation';

-- ----------------------------------------------------------------------------
-- 6. FIRST ADMIN ACCOUNT
-- Holds full_access at global scope. The password below is a temporary
-- value hashed with bcrypt through pgcrypto. Log in once and change it
-- immediately from the application; do not keep this password in production.
-- ----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (username, password_hash, full_name, email, account_status)
VALUES (
    'admin',
    crypt('ChangeMe123!', gen_salt('bf')),
    'System Administrator',
    'admin@microsoftcampusclub-kfs.org',
    'active'
);

INSERT INTO user_roles (user_id, role_id, scope_type, scope_id)
SELECT u.id, r.id, 'global', NULL
FROM users u, roles r
WHERE u.username = 'admin' AND r.code = 'full_access';
