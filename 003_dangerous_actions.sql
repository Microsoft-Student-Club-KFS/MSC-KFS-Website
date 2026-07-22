-- ============================================================================
-- Microsoft Campus Club - KFS
-- Patch: dangerous system actions (e.g. full data reset)
-- File: 003_dangerous_actions.sql
-- Run after 002_seed.sql
-- ============================================================================
--
-- Adds a dedicated permission for irreversible system-wide actions, granted
-- only to the full_access role, plus an audit log that records who
-- performed the action and the confirmation text they typed.
-- ============================================================================

INSERT INTO permissions (code, description) VALUES
    ('system.reset_data', 'Wipe operational data (members, enrollments, evaluations, attendance). Irreversible.');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'full_access' AND p.code = 'system.reset_data';

CREATE TABLE system_action_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action_code         VARCHAR(80) NOT NULL,
    confirmation_text   VARCHAR(150) NOT NULL,
    performed_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_action_logs_user ON system_action_logs(user_id);
