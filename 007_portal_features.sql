-- ============================================================================
-- Microsoft Campus Club - KFS
-- Patch 007: Group Sessions, Attendance, Assignments, and Submissions
-- File: 007_portal_features.sql
-- Run after 006_board_app_details.sql
-- ============================================================================

-- 1. Create table for Group Sessions (posted by mentor/lead)
CREATE TABLE group_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    meeting_url TEXT NOT NULL,
    session_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create table for Attendance tracking
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'excused')),
    marked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT uq_session_user UNIQUE (session_id, user_id)
);

-- 3. Create table for Tasks / Assignments (created by mentor/lead)
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Create table for Assignment Submissions (submitted by students, graded by mentor)
CREATE TABLE assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_text TEXT,
    submission_url TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    grade NUMERIC(5,2),
    feedback TEXT,
    graded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    graded_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_assignment_user UNIQUE (assignment_id, user_id)
);
