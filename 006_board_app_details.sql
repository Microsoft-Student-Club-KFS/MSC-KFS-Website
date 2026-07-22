-- ============================================================================
-- Microsoft Campus Club - KFS
-- Patch 006: Detailed Board Applications, Referral, and Skills Info
-- File: 006_board_app_details.sql
-- Run after 005_applications.sql
-- ============================================================================

-- 1. Add fields for board department/role selection, referral, and skills to applications
ALTER TABLE applications ADD COLUMN desired_department_id UUID REFERENCES departments(id);
ALTER TABLE applications ADD COLUMN desired_role VARCHAR(100);
ALTER TABLE applications ADD COLUMN referral_source VARCHAR(50);
ALTER TABLE applications ADD COLUMN why_join TEXT;
ALTER TABLE applications ADD COLUMN skills TEXT;

-- 2. Update the constraints to check board details vs member details
ALTER TABLE applications DROP CONSTRAINT chk_application_desired_unit;

ALTER TABLE applications ADD CONSTRAINT chk_application_desired_details CHECK (
    (kind = 'member' AND desired_unit_id IS NOT NULL AND desired_department_id IS NULL AND desired_role IS NULL) OR
    (kind = 'board' AND desired_unit_id IS NULL AND desired_department_id IS NOT NULL AND desired_role IS NOT NULL)
);
