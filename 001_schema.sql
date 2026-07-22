-- ============================================================================
-- Microsoft Campus Club - KFS
-- Management System Database Schema
-- Engine: PostgreSQL 14+
-- File: 001_schema.sql
-- ============================================================================
--
-- Design notes
-- ----------------------------------------------------------------------------
-- 1. UNIT is a generalized concept for any sub-division under a Department.
--    - Under TMP, a Unit is a Track (Data Science, Analysis, Engineering...).
--    - Under Media, a Unit is a Section (Marketing, Graphics...).
--    - Under Operation, a Unit is a Section (PR, FR, HR, Logistics...).
--    Units can be added, renamed, or removed freely without changing schema.
--
-- 2. GROUP is a sub-team inside a Unit, assigned to one or more Mentors.
--    This supports the case where a single Track has multiple parallel
--    groups, each handled by a different Mentor.
--
-- 3. Roles are assigned to users with a SCOPE (global / department / unit /
--    group). This means the same role definition (e.g. "Lead") can be
--    reused across every Unit instead of creating a new role per Track.
--    Examples:
--      - President            -> scope: global
--      - Department Director  -> scope: department (department_id)
--      - Unit Lead / Vice Lead-> scope: unit (unit_id)
--      - Mentor                -> scope: group (group_id)
--      - Member                -> scope: group (group_id)
--
-- 4. Permissions are granular capabilities (e.g. "evaluation.create").
--    Roles are linked to permissions through role_permissions.
--    Access control at the application layer checks:
--       does the user hold a role, within the relevant scope,
--       that grants the required permission?
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------

CREATE TYPE member_status_type AS ENUM ('student', 'graduate');
CREATE TYPE account_status_type AS ENUM ('active', 'suspended', 'disabled');
CREATE TYPE unit_kind_type AS ENUM ('track', 'section');
CREATE TYPE leadership_position_type AS ENUM ('lead', 'vice_lead');
CREATE TYPE enrollment_status_type AS ENUM ('active', 'completed', 'dropped');
CREATE TYPE evaluation_type_enum AS ENUM ('attendance', 'task', 'performance');
CREATE TYPE attendance_status_type AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE role_scope_type AS ENUM ('global', 'department', 'unit', 'group');

-- ----------------------------------------------------------------------------
-- USERS
-- One account per person. Every person in the system, whether board member,
-- director, lead, mentor, or member, is represented as a user.
-- ----------------------------------------------------------------------------

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username            VARCHAR(50)  NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    full_name           VARCHAR(150) NOT NULL,
    email               VARCHAR(150) NOT NULL UNIQUE,
    account_status      account_status_type NOT NULL DEFAULT 'active',

    member_status       member_status_type,   -- student / graduate, nullable for pure staff-only accounts
    university_name     VARCHAR(150),
    university_year     VARCHAR(30),
    company_name        VARCHAR(150),
    job_title           VARCHAR(150),
    linkedin_url        VARCHAR(255),
    github_url          VARCHAR(255),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_full_name_english CHECK (full_name ~ '^[A-Za-z''\-\.\s]+$'),
    CONSTRAINT chk_email_format CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT chk_member_status_fields CHECK (
        (member_status = 'student'  AND university_name IS NOT NULL) OR
        (member_status = 'graduate' AND company_name IS NOT NULL) OR
        (member_status IS NULL)
    )
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- ----------------------------------------------------------------------------
-- DEPARTMENTS
-- Fixed top-level divisions: TMP, Media, Operation.
-- Kept as a table (not an enum) so a new department could be added later
-- without a schema migration.
-- ----------------------------------------------------------------------------

CREATE TABLE departments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          VARCHAR(30) NOT NULL UNIQUE,
    name          VARCHAR(100) NOT NULL,
    description   TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE department_directors (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id  UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (department_id, user_id)
);

-- ----------------------------------------------------------------------------
-- UNITS (Tracks under TMP, Sections under Media/Operation)
-- ----------------------------------------------------------------------------

CREATE TABLE units (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id  UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    code           VARCHAR(30) NOT NULL,
    name           VARCHAR(100) NOT NULL,
    kind           unit_kind_type NOT NULL,
    description    TEXT,
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (department_id, code)
);

CREATE TABLE unit_leadership (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id        UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position       leadership_position_type NOT NULL,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, user_id, position)
);

-- ----------------------------------------------------------------------------
-- GROUPS
-- A Unit (mainly Tracks) can have multiple parallel groups, each run by
-- one or more mentors.
-- ----------------------------------------------------------------------------

CREATE TABLE groups (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id        UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    code           VARCHAR(30) NOT NULL,
    name           VARCHAR(100) NOT NULL,
    capacity       INTEGER,
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (unit_id, code)
);

CREATE TABLE group_mentors (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id       UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (group_id, user_id)
);

-- ----------------------------------------------------------------------------
-- MEMBERS AND ENROLLMENT
-- A member is a user who is enrolled as a learner in the club programs.
-- ----------------------------------------------------------------------------

CREATE TABLE members (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    joined_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active      BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE member_enrollments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    group_id       UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    status         enrollment_status_type NOT NULL DEFAULT 'active',
    enrolled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    left_at        TIMESTAMPTZ,
    UNIQUE (member_id, group_id, enrolled_at)
);

CREATE INDEX idx_member_enrollments_member ON member_enrollments(member_id);
CREATE INDEX idx_member_enrollments_group ON member_enrollments(group_id);

-- ----------------------------------------------------------------------------
-- EVALUATIONS AND ATTENDANCE
-- Any user with the relevant permission can evaluate the members under
-- their scope (a Mentor evaluates members of their Group, a Unit Lead can
-- evaluate across the Unit, and so on, enforced at the application layer).
-- ----------------------------------------------------------------------------

CREATE TABLE evaluations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id        UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    group_id         UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    evaluator_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    evaluation_type  evaluation_type_enum NOT NULL,
    title            VARCHAR(150) NOT NULL,
    score            NUMERIC(5,2),
    max_score        NUMERIC(5,2),
    notes            TEXT,
    evaluation_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_member ON evaluations(member_id);
CREATE INDEX idx_evaluations_group ON evaluations(group_id);

CREATE TABLE attendance_records (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    group_id       UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    session_date   DATE NOT NULL,
    status         attendance_status_type NOT NULL,
    recorded_by    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (member_id, group_id, session_date)
);

CREATE INDEX idx_attendance_member ON attendance_records(member_id);
CREATE INDEX idx_attendance_group ON attendance_records(group_id);

-- ----------------------------------------------------------------------------
-- ROLES AND PERMISSIONS (Scoped RBAC)
-- ----------------------------------------------------------------------------

CREATE TABLE roles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          VARCHAR(50) NOT NULL UNIQUE,
    name          VARCHAR(100) NOT NULL,
    description   TEXT
);

CREATE TABLE permissions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code          VARCHAR(80) NOT NULL UNIQUE,
    description   TEXT
);

CREATE TABLE role_permissions (
    role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id  UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- user_roles assigns a role to a user within a defined scope.
-- scope_id points to the relevant table depending on scope_type:
--   global      -> scope_id is NULL
--   department  -> scope_id references departments.id
--   unit        -> scope_id references units.id
--   group       -> scope_id references groups.id
-- Referential integrity for scope_id is enforced at the application layer
-- since it targets different tables depending on scope_type.

CREATE TABLE user_roles (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    scope_type     role_scope_type NOT NULL,
    scope_id       UUID,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_scope_id_required CHECK (
        (scope_type = 'global' AND scope_id IS NULL) OR
        (scope_type != 'global' AND scope_id IS NOT NULL)
    )
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_scope ON user_roles(scope_type, scope_id);

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
