/**
 * Microsoft Campus Club - KFS
 * Applications Routes
 * File: backend/src/routes/applications.routes.js
 */

const express = require('express');
const controller = require('../controllers/application.controller');
const authenticate = require('../middleware/authenticate');
const { loadPermissions, requirePermission } = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Public endpoints
router.get('/status', asyncHandler(controller.getStatus));
router.get('/tracks', asyncHandler(controller.getTracks));
router.get('/departments', asyncHandler(controller.getDepartments));
router.post('/', asyncHandler(controller.submit));

// Authenticated endpoints below
router.use(asyncHandler(authenticate), asyncHandler(loadPermissions));

router.get('/', requirePermission('application.manage'), asyncHandler(controller.list));
router.patch('/windows/:kind', requirePermission('application.manage'), asyncHandler(controller.toggleWindow));
router.patch('/:id/decision', requirePermission('application.manage'), asyncHandler(controller.decide));

module.exports = router;
