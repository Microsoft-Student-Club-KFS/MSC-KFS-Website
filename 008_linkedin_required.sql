-- ============================================================================
-- Microsoft Campus Club - KFS
-- Patch 008: Mandatory LinkedIn URLs
-- File: 008_linkedin_required.sql
-- Run after 007_portal_features.sql
-- ============================================================================

-- 1. Backfill NULL values with a placeholder URL
UPDATE users SET linkedin_url = 'https://linkedin.com/in/placeholder' WHERE linkedin_url IS NULL;
UPDATE applications SET linkedin_url = 'https://linkedin.com/in/placeholder' WHERE linkedin_url IS NULL;

-- 2. Enforce NOT NULL on both columns
ALTER TABLE users ALTER COLUMN linkedin_url SET NOT NULL;
ALTER TABLE applications ALTER COLUMN linkedin_url SET NOT NULL;
