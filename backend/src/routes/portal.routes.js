/**
 * Microsoft Campus Club - KFS
 * Portal Routes (Sessions, Attendance, Assignments, Submissions, Stats)
 * File: backend/src/routes/portal.routes.js
 */

const express = require('express');
const controller = require('../controllers/portal.controller');
const authenticate = require('../middleware/authenticate');
const { loadPermissions, requirePermission } = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All portal routes require authentication and permissions loading
router.use(asyncHandler(authenticate), asyncHandler(loadPermissions));

// 1. Dashboard Stats (Global Admin)
router.get('/dashboard/stats', requirePermission('application.manage'), asyncHandler(controller.getDashboardStats));

// 2. Group Sessions
router.get('/groups/:id/sessions', asyncHandler(controller.getGroupSessions));
router.post('/groups/:id/sessions', asyncHandler(controller.createGroupSession));

// 3. Session Attendance
router.get('/sessions/:id/attendance', asyncHandler(controller.getSessionAttendance));
router.post('/sessions/:id/attendance', asyncHandler(controller.saveSessionAttendance));

// 4. Group Assignments / Tasks
router.get('/groups/:id/assignments', asyncHandler(controller.getGroupAssignments));
router.post('/groups/:id/assignments', asyncHandler(controller.createAssignment));

// 5. Task Submissions
router.get('/assignments/:id/submissions', asyncHandler(controller.getAssignmentSubmissions));
router.post('/assignments/:id/submissions', asyncHandler(controller.submitAssignment));

// 6. Grading
router.patch('/submissions/:id/grade', asyncHandler(controller.gradeSubmission));

// 7. Student metrics
router.get('/my-metrics', asyncHandler(controller.getMyMetrics));

// 8. SMTP / System Settings
router.get('/settings/smtp', requirePermission('application.manage'), asyncHandler(controller.getSMTPSettings));
router.post('/settings/smtp', requirePermission('application.manage'), asyncHandler(controller.saveSMTPSettings));
router.post('/settings/smtp/test', requirePermission('application.manage'), asyncHandler(controller.testSMTPSettings));

module.exports = router;
