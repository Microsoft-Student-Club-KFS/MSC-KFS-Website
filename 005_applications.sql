-- ============================================================================
-- Microsoft Campus Club - KFS
-- Patch 005: Public Applications, Interviews, Auto-Assignment, VCF Export
-- File: 005_applications.sql
-- Run after 004_structural_fixes.sql
-- ============================================================================

-- 1. Add phone_number to users table
ALTER TABLE users ADD COLUMN phone_number VARCHAR(30);

-- 2. Add short_code to units table for VCF export prefix naming
ALTER TABLE units ADD COLUMN short_code VARCHAR(10);

-- Backfill existing seeded rows with sensible short codes
UPDATE units SET short_code = 'ds' WHERE code = 'data_science';
UPDATE units SET short_code = 'an' WHERE code = 'analysis';
UPDATE units SET short_code = 'en' WHERE code = 'engineering';
UPDATE units SET short_code = 'mkt' WHERE code = 'marketing';
UPDATE units SET short_code = 'gfx' WHERE code = 'graphics';
UPDATE units SET short_code = 'pr' WHERE code = 'pr';
UPDATE units SET short_code = 'fr' WHERE code = 'fr';
UPDATE units SET short_code = 'hr' WHERE code = 'hr';
UPDATE units SET short_code = 'log' WHERE code = 'logistics';

-- 3. Create application types/enums and application tables
CREATE TYPE application_kind_type AS ENUM ('board', 'member');
CREATE TYPE application_status_type AS ENUM ('pending', 'accepted', 'rejected');

CREATE TABLE application_windows (
    kind          application_kind_type PRIMARY KEY,
    is_open       BOOLEAN NOT NULL DEFAULT false,
    updated_by    UUID REFERENCES users(id),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO application_windows (kind, is_open) VALUES ('board', false), ('member', false);

CREATE TABLE applications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind                application_kind_type NOT NULL,
    full_name           VARCHAR(150) NOT NULL,
    email               VARCHAR(150) NOT NULL,
    phone_number        VARCHAR(30) NOT NULL,
    member_status       member_status_type,        -- reuse existing enum
    university_name     VARCHAR(150),
    university_year     VARCHAR(30),
    company_name        VARCHAR(150),
    job_title           VARCHAR(150),
    linkedin_url        VARCHAR(255),
    github_url          VARCHAR(255),
    desired_unit_id     UUID REFERENCES units(id), -- required if kind='member', NULL if kind='board'
    status              application_status_type NOT NULL DEFAULT 'pending',
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    review_notes        TEXT,
    assigned_group_id   UUID REFERENCES groups(id),  -- filled in automatically on accept, member kind only
    created_user_id     UUID REFERENCES users(id),   -- filled in automatically on accept
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_application_full_name_english CHECK (full_name ~ '^[A-Za-z''\-\.\s]+$'),
    CONSTRAINT chk_application_desired_unit CHECK (
        (kind = 'member' AND desired_unit_id IS NOT NULL) OR
        (kind = 'board' AND desired_unit_id IS NULL)
    )
);

CREATE INDEX idx_applications_kind_status ON applications(kind, status);
CREATE INDEX idx_applications_desired_unit ON applications(desired_unit_id);

-- 4. Create new permission and map to full_access role
INSERT INTO permissions (code, description) VALUES
    ('application.manage', 'Review applications, decide accept/reject, and open or close application windows');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'full_access' AND p.code = 'application.manage';
